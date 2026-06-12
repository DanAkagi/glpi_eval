import axios from 'axios';

interface OAuth2TokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token?: string;
}

// All asset itemtypes supported by GLPI API
export const ASSET_ITEM_TYPES = [
  'Computer', 'Monitor', 'NetworkEquipment', 'Peripheral',
  'Phone', 'Printer', 'SoftwareLicense', 'Certificate',
  'Unmanaged', 'Appliance'
] as const;
export type AssetItemType = typeof ASSET_ITEM_TYPES[number];

// CSV Item_Type → GLPI itemtype mapping
export const CSV_TYPE_TO_GLPI: Record<string, AssetItemType> = {
  'Computer':           'Computer',
  'Monitor':            'Monitor',
  'Moniteur':           'Monitor',
  'NetworkEquipment':   'NetworkEquipment',
  'Réseau':             'NetworkEquipment',
  'Reseau':             'NetworkEquipment',
  'Peripheral':         'Peripheral',
  'Périphérique':       'Peripheral',
  'Peripherique':       'Peripheral',
  'Phone':              'Phone',
  'Téléphone':          'Phone',
  'Telephone':          'Phone',
  'Printer':            'Printer',
  'Imprimante':         'Printer',
  'SoftwareLicense':    'SoftwareLicense',
  'Licence':            'SoftwareLicense',
  'Certificate':        'Certificate',
  'Certificat':         'Certificate',
  'Unmanaged':          'Unmanaged',
  'Appliance':          'Appliance',
};

class GLPIApiService {
  private baseUrl: string;
  private legacyBaseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private username: string;
  private password: string;

  // High-Level API (api.php) — OAuth2 Bearer token
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  // Legacy API (apirest.php) — Session-Token
  private sessionToken: string | null = null;
  private sessionExpiry: number | null = null;

  constructor() {
    this.baseUrl       = process.env.GLPI_API_URL || 'http://localhost/glpi/public/api.php';
    this.legacyBaseUrl = this.baseUrl.replace(/\/api\.php$/, '/apirest.php');
    this.clientId      = process.env.GLPI_CLIENT_ID || '';
    this.clientSecret  = process.env.GLPI_CLIENT_SECRET || '';
    this.username      = process.env.GLPI_USERNAME || 'glpi';
    this.password      = process.env.GLPI_PASSWORD || 'glpi';
  }

  // ── High-Level API auth (OAuth2 Bearer) ─────────────────────────────────

  async authenticate(): Promise<OAuth2TokenResponse> {
    const params = new URLSearchParams({
      grant_type:    'password',
      client_id:     this.clientId,
      client_secret: this.clientSecret,
      username:      this.username,
      password:      this.password,
      scope:         'api'
    });

    const response = await axios.post(
      `${this.baseUrl}/token?${params.toString()}`,
      {},
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    this.accessToken  = response.data.access_token;
    this.tokenExpiry  = Date.now() + (response.data.expires_in * 1000);
    return response.data;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry - 60000) {
      await this.authenticate();
    }
  }

  private authHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'User-Agent': 'Mozilla/5.0'
    };
  }

  // ── Legacy API auth (Session-Token via initSession) ──────────────────────
  // GLPI's apirest.php requires a Session-Token obtained from GET /initSession.
  // It does NOT accept Bearer tokens. Sessions expire after 1h by default.

  async authenticateLegacy(): Promise<string> {
    const response = await axios.get(`${this.legacyBaseUrl}/initSession`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
        'App-Token':   this.clientId,
        'User-Agent':  'Mozilla/5.0',
      }
    });

    this.sessionToken  = response.data.session_token;
    this.sessionExpiry = Date.now() + (55 * 60 * 1000); // refresh 5min before 1h expiry
    console.log('[GLPI Legacy] Session token obtained');
    return this.sessionToken!;
  }

  private async ensureLegacySession(): Promise<void> {
    if (!this.sessionToken || !this.sessionExpiry || Date.now() >= this.sessionExpiry) {
      await this.authenticateLegacy();
    }
  }

  private legacyHeaders() {
    return {
      'Session-Token': this.sessionToken!,
      'App-Token':     this.clientId,
      'Content-Type':  'application/json',
      'User-Agent':    'Mozilla/5.0',
    };
  }

  // ── High-Level API methods ────────────────────────────────────────────────

  async get(endpoint: string, params?: Record<string, any>): Promise<any> {
    await this.ensureAuthenticated();
    const response = await axios.get(`${this.baseUrl}${endpoint}`, {
      headers: this.authHeaders(),
      params
    });
    return response.data;
  }

  async post(endpoint: string, data: any): Promise<any> {
    await this.ensureAuthenticated();
    const response = await axios.post(`${this.baseUrl}${endpoint}`, data, {
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' }
    });
    return response.data;
  }

  async patch(endpoint: string, data: any): Promise<any> {
    await this.ensureAuthenticated();
    const response = await axios.patch(`${this.baseUrl}${endpoint}`, data, {
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' }
    });
    return response.data;
  }

  async delete(endpoint: string, force = true): Promise<any> {
    await this.ensureAuthenticated();
    const response = await axios.delete(`${this.baseUrl}${endpoint}`, {
      headers: this.authHeaders(),
      params: { force }
    });
    return response.data;
  }

  // ── Legacy API methods (apirest.php — uses Session-Token) ─────────────────

  async postLegacy(endpoint: string, data: any): Promise<any> {
    await this.ensureLegacySession();
    try {
      const response = await axios.post(`${this.legacyBaseUrl}${endpoint}`, data, {
        headers: this.legacyHeaders()
      });
      return response.data;
    } catch (err: any) {
      console.error(`[GLPI Legacy] POST ${endpoint} failed:`, JSON.stringify(err?.response?.data));
      throw err;
    }
  }

  async getLegacy(endpoint: string, params?: Record<string, any>): Promise<any> {
    await this.ensureLegacySession();
    const response = await axios.get(`${this.legacyBaseUrl}${endpoint}`, {
      headers: this.legacyHeaders(),
      params
    });
    return response.data;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  async getAssetItemTypes(): Promise<AssetItemType[]> {
    try {
      const response = await this.get('/Assets/');
      const glpiTypes = (response || [])
        .map((t: any) => t.itemtype as string)
        .filter((t: string) => (ASSET_ITEM_TYPES as readonly string[]).includes(t));
      return glpiTypes.length > 0 ? glpiTypes : [...ASSET_ITEM_TYPES];
    } catch {
      return [...ASSET_ITEM_TYPES];
    }
  }
}

export const glpiApiService = new GLPIApiService();
