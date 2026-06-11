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
  private clientId: string;
  private clientSecret: string;
  private username: string;
  private password: string;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.baseUrl = process.env.GLPI_API_URL || 'http://localhost/glpi/public/api.php';
    this.clientId = process.env.GLPI_CLIENT_ID || '';
    this.clientSecret = process.env.GLPI_CLIENT_SECRET || '';
    this.username = process.env.GLPI_USERNAME || 'glpi';
    this.password = process.env.GLPI_PASSWORD || 'glpi';
  }

  async authenticate(): Promise<OAuth2TokenResponse> {
    // Token endpoint requires params in query string on XAMPP/Windows (PHP php://input issue)
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      username: this.username,
      password: this.password,
      scope: 'api'
    });

    const response = await axios.post(
      `${this.baseUrl}/token?${params.toString()}`,
      {},
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );

    this.accessToken = response.data.access_token;
    this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
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

  // Upload multipart/form-data (for GLPI Document API)
  async postMultipart(endpoint: string, formData: FormData): Promise<any> {
    await this.ensureAuthenticated();
    const response = await axios.post(`${this.baseUrl}${endpoint}`, formData, {
      headers: {
        ...this.authHeaders(),
        // Do NOT set Content-Type manually — axios sets it with boundary automatically
      }
    });
    return response.data;
  }

  // Legacy API — used for relationships not exposed in the High-Level API:
  // Item_Ticket (ticket↔asset link), Document_Item (document↔asset link)
  // Base URL: /glpi/public/apirest.php  (derived from GLPI_API_URL)
  async postLegacy(endpoint: string, data: any): Promise<any> {
    await this.ensureAuthenticated();
    const legacyBase = this.baseUrl.replace(/\/api\.php$/, '/apirest.php');
    const response = await axios.post(`${legacyBase}${endpoint}`, data, {
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' }
    });
    return response.data;
  }

  async getLegacy(endpoint: string, params?: Record<string, any>): Promise<any> {
    await this.ensureAuthenticated();
    const legacyBase = this.baseUrl.replace(/\/api\.php$/, '/apirest.php');
    const response = await axios.get(`${legacyBase}${endpoint}`, {
      headers: this.authHeaders(),
      params
    });
    return response.data;
  }

  // force=true → permanent delete (no soft-delete trash)
  async delete(endpoint: string, force = true): Promise<any> {
    await this.ensureAuthenticated();
    const response = await axios.delete(`${this.baseUrl}${endpoint}`, {
      headers: this.authHeaders(),
      params: { force }
    });
    return response.data;
  }

  // Fetch all available asset itemtypes from GLPI
  async getAssetItemTypes(): Promise<AssetItemType[]> {
    try {
      const response = await this.get('/Assets/');
      // Response: [{ itemtype, name, href }]
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