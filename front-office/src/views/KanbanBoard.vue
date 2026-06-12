<template>
  <div class="kanban-page">
    <!-- Header bar -->
    <div class="kanban-topbar">
      <div class="kanban-title">
        <span class="kanban-icon">🗂️</span>
        <h1>Tableau Kanban – Tickets</h1>
      </div>
      <button class="btn-add" @click="showCreateModal = true">
        <span class="btn-add-icon">＋</span> Ajouter 1 ticket
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Chargement des tickets…</p>
    </div>

    <!-- Kanban board -->
    <div v-else class="kanban-board">
      <div
        v-for="col in columns"
        :key="col.id"
        class="kanban-column"
        :style="{ background: col.color }"
        @dragover.prevent
        @drop="onDrop($event, col.id)"
      >
        <!-- Column header -->
        <div class="column-header">
          <div class="column-title-wrap">
            <span class="column-label">{{ col.labelMg }}</span>
            <span class="column-label-en">({{ col.label }})</span>
          </div>
          <span class="column-count">{{ ticketsByColumn(col.id).length }}</span>
        </div>

        <!-- Ticket cards -->
        <div class="cards-area">
          <div
            v-for="ticket in ticketsByColumn(col.id)"
            :key="ticket.id"
            class="ticket-card"
            draggable="true"
            @dragstart="onDragStart($event, ticket)"
            @click="openDetail(ticket)"
          >
            <div class="card-ref">#{{ ticket.ref_ticket || ticket.id }}</div>
            <div class="card-title">{{ ticket.titre }}</div>
            <div class="card-meta">
              <span class="badge-type" :class="ticket.type?.toLowerCase()">{{ ticket.type }}</span>
              <span class="badge-priority" :class="priorityClass(ticket.priority)">{{ ticket.priority }}</span>
            </div>
            <div class="card-date">{{ formatDate(ticket.date) }}</div>
          </div>

          <div v-if="ticketsByColumn(col.id).length === 0" class="empty-col">
            Tsy misy ticket
          </div>
        </div>
      </div>
    </div>

    <!-- ── Detail Modal ── -->
    <div v-if="detailTicket" class="modal-overlay" @click.self="detailTicket = null">
      <div class="modal-box modal-detail">
        <div class="modal-header">
          <h2>Ticket #{{ detailTicket.ref_ticket || detailTicket.id }}</h2>
          <button class="modal-close" @click="detailTicket = null">✕</button>
        </div>
        <div class="modal-body">
          <div class="detail-grid">
            <div class="detail-item"><span class="dl">Titre</span><span class="dv">{{ detailTicket.titre }}</span></div>
            <div class="detail-item"><span class="dl">Type</span><span class="dv"><span class="badge-type" :class="detailTicket.type?.toLowerCase()">{{ detailTicket.type }}</span></span></div>
            <div class="detail-item"><span class="dl">Statut</span><span class="dv">{{ detailTicket.status }}</span></div>
            <div class="detail-item"><span class="dl">Priorité</span><span class="dv"><span class="badge-priority" :class="priorityClass(detailTicket.priority)">{{ detailTicket.priority }}</span></span></div>
            <div class="detail-item"><span class="dl">Date</span><span class="dv">{{ formatDate(detailTicket.date) }}</span></div>
            <div class="detail-item full"><span class="dl">Description</span><span class="dv desc">{{ detailTicket.description || 'Aucune description' }}</span></div>
            <div class="detail-item full" v-if="detailTicket.items && detailTicket.items.length > 0">
              <span class="dl">Assets associés</span>
              <div class="assets-list">
                <div v-for="(item, i) in detailTicket.items" :key="i" class="asset-chip" :class="`asset-${(item.itemtype || 'default').toLowerCase()}`">
                  <span class="asset-chip-icon">{{ assetIcon(item.itemtype) }}</span>
                  <span class="asset-chip-name">{{ item.name || `#${item.id}` }}</span>
                  <span class="asset-chip-type">{{ item.itemtype }}</span>
                </div>
              </div>
            </div>
            <div class="detail-item full" v-if="detailTicket.costs && detailTicket.costs.length > 0">
              <span class="dl">Coûts</span>
              <table class="costs-table">
                <thead><tr><th>Durée (s)</th><th>Coût temps</th><th>Coût fixe</th><th>Coût matériel</th></tr></thead>
                <tbody>
                  <tr v-for="(c,i) in detailTicket.costs" :key="i">
                    <td>{{ c.duration_second }}</td><td>{{ c.time_cost }}</td><td>{{ c.fixed_cost }}</td><td>{{ c.material_cost }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="detailTicket = null">Fermer</button>
        </div>
      </div>
    </div>

    <!-- ── Status change dialog (needs extra info) ── -->
    <div v-if="statusDialog.show" class="modal-overlay" @click.self="cancelStatusChange">
      <div class="modal-box modal-status">
        <div class="modal-header">
          <h2>Changement de statut</h2>
          <button class="modal-close" @click="cancelStatusChange">✕</button>
        </div>
        <div class="modal-body">
          <p class="status-change-info">
            Déplacer le ticket <strong>#{{ statusDialog.ticket?.ref_ticket || statusDialog.ticket?.id }}</strong>
            vers <strong>{{ statusDialog.targetLabel }}</strong>
          </p>

          <!-- Closing requires reason -->
          <div v-if="statusDialog.targetId === 'closed'" class="form-group">
            <label>Motif de clôture <span class="required">*</span></label>
            <textarea v-model="statusDialog.resolution" rows="3" placeholder="Décrivez la résolution du ticket…"></textarea>
          </div>

          <div v-if="statusDialog.targetId === 'closed'" class="form-group">
            <label>Coût supplémentaire<span class="required">*</span></label>
            <input v-model="statusDialog.super_cost" type="number" min="0" step="0.01" placeholder="Ex:10.0"></input>
          </div>

          <!-- In progress requires assignee -->
          <div v-if="statusDialog.targetId === 'in_progress'" class="form-group">
            <label>Assigné à <span class="required">*</span></label>
            <input v-model="statusDialog.assignee" type="text" placeholder="Nom du technicien…" />
          </div>

          <p v-if="statusDialog.error" class="error-msg">{{ statusDialog.error }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="cancelStatusChange">Annuler</button>
          <button class="btn-primary" @click="confirmStatusChange">Confirmer</button>
        </div>
      </div>
    </div>

    <!-- ── Create ticket modal ── -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="showCreateModal = false">
      <div class="modal-box modal-create">
        <div class="modal-header">
          <h2>Nouveau ticket</h2>
          <button class="modal-close" @click="showCreateModal = false">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Type <span class="required">*</span></label>
            <select v-model="newTicket.type">
              <option value="">-- Sélectionner --</option>
              <option value="Incident">Incident</option>
              <option value="Request">Request</option>
            </select>
          </div>
          <div class="form-group">
            <label>Titre <span class="required">*</span></label>
            <input v-model="newTicket.titre" type="text" placeholder="Titre du ticket" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="newTicket.description" rows="3" placeholder="Description…"></textarea>
          </div>
          <div class="form-group">
            <label>Priorité <span class="required">*</span></label>
            <select v-model="newTicket.priority">
              <option value="">-- Sélectionner --</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Very High">Very High</option>
            </select>
          </div>
          <div class="form-group">
            <label>Date <span class="required">*</span></label>
            <input v-model="newTicket.date" type="date" />
          </div>
          <div class="form-group">
            <label for="heure">Time *</label>
            <input id="heure" v-model="newTicket.heure" type="time" required />
          </div>

          <div class="form-group">
            <label>Assets associés</label>
            <div class="asset-picker">
              <input v-model="assetSearch" type="text" placeholder="Rechercher un asset…" @input="loadAssets" />
              <div class="asset-picker-list">
                <div v-if="loadingAssets" class="asset-picker-empty">Chargement…</div>
                <div v-else-if="availableAssets.length === 0" class="asset-picker-empty">Aucun asset trouvé</div>
                <label v-else v-for="asset in availableAssets" :key="`${asset.item_type}-${asset.id}`" class="asset-picker-item">
                  <input type="checkbox" :value="asset" v-model="selectedAssets" />
                  <span class="asset-picker-name">{{ asset.name }}</span>
                  <span class="asset-picker-type">{{ asset.item_type }}</span>
                </label>
              </div>
              <div v-if="selectedAssets.length > 0" class="asset-picker-selected">
                {{ selectedAssets.length }} asset(s) sélectionné(s)
              </div>
            </div>
          </div>

          <p v-if="createError" class="error-msg">{{ createError }}</p>
          <p v-if="createSuccess" class="success-msg">{{ createSuccess }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" @click="showCreateModal = false">Annuler</button>
          <button class="btn-primary" :disabled="creatingTicket || !isCreateValid" @click="submitCreate">
            {{ creatingTicket ? 'Création…' : 'Créer le ticket' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ticketsApi, costsApi, kanbanApi, assetsApi } from '../services/api';

// ── State ─────────────────────────────────────────────
const tickets = ref<any[]>([]);
const loading = ref(true);
const columns = ref<any[]>([]);

const detailTicket = ref<any>(null);
const showCreateModal = ref(false);
const creatingTicket = ref(false);
const createError = ref('');
const createSuccess = ref('');

const newTicket = ref({ type: '', titre: '', description: '', priority: '', date: new Date().toISOString().split('T')[0] });

// Asset picker (for "Assets associés")
const availableAssets = ref<any[]>([]);
const selectedAssets = ref<any[]>([]);
const assetSearch = ref('');
const loadingAssets = ref(false);
let assetSearchTimeout: ReturnType<typeof setTimeout> | null = null;

async function loadAssets() {
  if (assetSearchTimeout) clearTimeout(assetSearchTimeout);
  assetSearchTimeout = setTimeout(async () => {
    loadingAssets.value = true;
    try {
      const res = await assetsApi.getAll(assetSearch.value ? { name: assetSearch.value } : undefined);
      availableAssets.value = (res.data || []).slice(0, 30);
    } catch {
      availableAssets.value = [];
    } finally {
      loadingAssets.value = false;
    }
  }, 250);
}

const draggedTicket = ref<any>(null);

const statusDialog = ref({
  show: false,
  ticket: null as any,
  targetId: '',
  targetLabel: '',
  resolution: '',
  super_cost: 0 as Number,
  assignee: '',
  error: '',
});

// ── Kanban status mapping ──────────────────────────────
// Maps column id ↔ GLPI status string
const COL_TO_STATUS: Record<string, string[]> = {
  new:         ['New', 'Validation'],
  in_progress: ['Assigned', 'Planned', 'Waiting'],
  closed:      ['Solved', 'Closed'],
};

const STATUS_TO_COL: Record<string, string> = {};
Object.entries(COL_TO_STATUS).forEach(([col, statuses]) => {
  statuses.forEach(s => { STATUS_TO_COL[s] = col; });
});

// Default columns (overridden by backend config)
const DEFAULT_COLUMNS = [
  { id: 'new',         label: 'New',         labelMg: 'Vaovao',    color: '#e3f2fd' },
  { id: 'in_progress', label: 'In Progress',  labelMg: 'Efa manao', color: '#fff8e1' },
  { id: 'closed',      label: 'Closed',       labelMg: 'Vita',      color: '#e8f5e9' },
];

// ── Computed ───────────────────────────────────────────
const isCreateValid = computed(() =>
  newTicket.value.type && newTicket.value.titre && newTicket.value.priority && newTicket.value.date
);

function ticketsByColumn(colId: string) {
  return tickets.value.filter(t => (STATUS_TO_COL[t.status] || 'new') === colId);
}

// ── Load data ──────────────────────────────────────────
onMounted(async () => {
  await Promise.all([loadConfig(), loadTickets()]);
  loadAssets();
});

async function loadConfig() {
  try {
    const res = await kanbanApi.getConfig();
    columns.value = res.data.columns;
  } catch {
    columns.value = DEFAULT_COLUMNS;
  }
}

async function loadTickets() {
  loading.value = true;
  try {
    const res = await ticketsApi.getAll();
    tickets.value = res.data;
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

// ── Drag & Drop ────────────────────────────────────────
function onDragStart(e: DragEvent, ticket: any) {
  draggedTicket.value = ticket;
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
}

async function onDrop(e: DragEvent, targetColId: string) {
  e.preventDefault();
  const ticket = draggedTicket.value;
  if (!ticket) return;

  const currentCol = STATUS_TO_COL[ticket.status] || 'new';
  if (currentCol === targetColId) return;

  const col = columns.value.find(c => c.id === targetColId);
  const targetLabel = col ? `${col.labelMg} (${col.label})` : targetColId;

  // Check if extra info needed
  if (targetColId === 'closed' || targetColId === 'in_progress') {
    statusDialog.value = {
      show: true,
      ticket,
      targetId: targetColId,
      targetLabel,
      resolution: '',
      super_cost: 0 as Number,
      assignee: '',
      error: '',
    };
  } else {
    // Direct move to "new"
    await applyStatusChange(ticket, targetColId, 0, {});
  }
}

async function confirmStatusChange() {
  const d = statusDialog.value;

  if (d.targetId === 'closed' && !d.resolution.trim()) {
    d.error = 'Le motif de clôture est obligatoire.';
    return;
  }
  if (d.targetId === 'in_progress' && !d.assignee.trim()) {
    d.error = 'Le nom du technicien est obligatoire.';
    return;
  }

  const extra: any = {};
  if (d.resolution) extra.resolution = d.resolution;
  if (d.assignee) extra.assignee = d.assignee;

  await applyStatusChange(d.ticket, d.targetId, extra);

  if (d.targetId === 'closed' && d.super_cost && Number(d.super_cost) > 0) {
    try {
      await costsApi.create({
        ticket_id: d.ticket.id,
        amount: Number(d.super_cost),
      })
    } catch (e) {
      console.error('Erreur en ajout de super cost:', e);
    } 
  }
  statusDialog.value.show = false;
}

function cancelStatusChange() {
  statusDialog.value.show = false;
  draggedTicket.value = null;
}

async function applyStatusChange(ticket: any, targetColId: string, extra: any) {
  // Map column to GLPI status string
  const STATUS_MAP: Record<string, string> = {
    new: 'New',
    in_progress: 'Assigned',
    closed: 'Closed',
  };
  const newStatus = STATUS_MAP[targetColId] || 'New';

  // Optimistic update
  const idx = tickets.value.findIndex(t => t.id === ticket.id);
  if (idx !== -1) tickets.value[idx] = { ...tickets.value[idx], status: newStatus };

  try {
    await ticketsApi.update(ticket.id, { status: newStatus, ...extra });
  } catch (err) {
    console.error('Status update failed:', err);
    // Rollback
    if (idx !== -1) tickets.value[idx] = { ...tickets.value[idx], status: ticket.status };
  }
}

// ── Detail ─────────────────────────────────────────────
async function openDetail(ticket: any) {
  try {
    const res = await ticketsApi.getById(ticket.id.toString());
    detailTicket.value = res.data;
  } catch {
    detailTicket.value = ticket;
  }
}

// ── Create ticket ──────────────────────────────────────
async function submitCreate() {
  if (!isCreateValid.value) return;
  creatingTicket.value = true;
  createError.value = '';
  createSuccess.value = '';

  try {
    await ticketsApi.create({
      type: newTicket.value.type,
      titre: newTicket.value.titre,
      description: newTicket.value.description,
      priority: newTicket.value.priority,
      date: newTicket.value.date,
      date: newTicket.value.heure,
      status: 'New',
      items: selectedAssets.value.map(a => ({ id: a.id, item_type: a.item_type, name: a.name })),
    });
    createSuccess.value = 'Ticket créé avec succès !';
    newTicket.value = { type: '', titre: '', description: '', priority: '', date: new Date().toISOString().split('T')[0] };
    selectedAssets.value = [];
    assetSearch.value = '';
    await loadTickets();
    setTimeout(() => { showCreateModal.value = false; createSuccess.value = ''; }, 1500);
  } catch (e: any) {
    createError.value = e.response?.data?.error || 'Erreur lors de la création.';
  } finally {
    creatingTicket.value = false;
  }
}

// ── Helpers ────────────────────────────────────────────
function formatDate(d: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('fr-FR');
}

function priorityClass(p: string) {
  const map: Record<string, string> = {
    'Very Low': 'p-vlow', 'Low': 'p-low', 'Medium': 'p-medium',
    'High': 'p-high', 'Very High': 'p-vhigh',
  };
  return map[p] || 'p-medium';
}

function assetIcon(itemtype: string) {
  const map: Record<string, string> = {
    Computer: '🖥️', Monitor: '🖵', NetworkEquipment: '📡', Peripheral: '🖱️',
    Phone: '📱', Printer: '🖨️', SoftwareLicense: '💿', Certificate: '📜',
    Appliance: '⚙️', Unmanaged: '❓',
  };
  return map[itemtype] || '📦';
}
</script>

<style scoped>
/* ── Layout ─────────────────────────────────── */
.kanban-page {
  min-height: 100vh;
  background: #f0f4f8;
  padding: 0;
}

.kanban-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 2rem;
  background: #fff;
  border-bottom: 1px solid #dde3ea;
  position: sticky;
  top: 0;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}

.kanban-title {
  display: flex;
  align-items: center;
  gap: .6rem;
}

.kanban-title h1 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 700;
  color: #1a2233;
}

.kanban-icon { font-size: 1.5rem; }

.btn-add {
  display: flex;
  align-items: center;
  gap: .4rem;
  background: #3b82f6;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: .55rem 1.2rem;
  font-size: .95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background .18s;
}
.btn-add:hover { background: #2563eb; }
.btn-add-icon { font-size: 1.2rem; line-height: 1; }

/* ── Board ─────────────────────────────────── */
.kanban-board {
  display: flex;
  gap: 1.25rem;
  padding: 1.5rem 2rem;
  align-items: flex-start;
  overflow-x: auto;
  min-height: calc(100vh - 80px);
}

.kanban-column {
  flex: 1;
  min-width: 280px;
  max-width: 360px;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 2px 8px rgba(0,0,0,.08);
  transition: box-shadow .2s;
  min-height: 200px;
}

.kanban-column:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,.13);
}

.column-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.column-title-wrap {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.column-label {
  font-size: 1rem;
  font-weight: 700;
  color: #1a2233;
}

.column-label-en {
  font-size: .75rem;
  color: #6b7280;
}

.column-count {
  background: rgba(0,0,0,.12);
  color: #1a2233;
  font-weight: 700;
  font-size: .85rem;
  border-radius: 99px;
  padding: .15rem .55rem;
  min-width: 26px;
  text-align: center;
}

/* ── Cards ─────────────────────────────────── */
.cards-area {
  display: flex;
  flex-direction: column;
  gap: .65rem;
}

.ticket-card {
  background: #fff;
  border-radius: 8px;
  padding: .85rem 1rem;
  cursor: grab;
  box-shadow: 0 1px 4px rgba(0,0,0,.08);
  transition: transform .15s, box-shadow .15s;
  border-left: 3px solid #3b82f6;
}

.ticket-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,.14);
}

.ticket-card:active { cursor: grabbing; }

.card-ref {
  font-size: .75rem;
  color: #6b7280;
  font-weight: 600;
  margin-bottom: .2rem;
}

.card-title {
  font-size: .9rem;
  font-weight: 600;
  color: #1a2233;
  margin-bottom: .5rem;
  line-height: 1.3;
}

.card-meta {
  display: flex;
  gap: .4rem;
  flex-wrap: wrap;
  margin-bottom: .4rem;
}

.card-date {
  font-size: .72rem;
  color: #9ca3af;
}

.empty-col {
  text-align: center;
  color: #9ca3af;
  font-size: .85rem;
  padding: 2rem 0;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
}

/* ── Badges ────────────────────────────────── */
.badge-type, .badge-priority {
  font-size: .7rem;
  font-weight: 600;
  padding: .15rem .55rem;
  border-radius: 99px;
}

.badge-type.incident { background: #fee2e2; color: #b91c1c; }
.badge-type.request  { background: #dbeafe; color: #1d4ed8; }
.badge-type          { background: #e5e7eb; color: #374151; }

.p-vlow   { background: #f0fdf4; color: #15803d; }
.p-low    { background: #dcfce7; color: #15803d; }
.p-medium { background: #fef9c3; color: #a16207; }
.p-high   { background: #ffedd5; color: #c2410c; }
.p-vhigh  { background: #fee2e2; color: #b91c1c; }

/* ── Loading ───────────────────────────────── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 5rem;
  gap: 1rem;
  color: #6b7280;
}

.spinner {
  width: 40px; height: 40px;
  border: 4px solid #e5e7eb;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Modals ────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.modal-box {
  background: #fff;
  border-radius: 12px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,.25);
}

.modal-detail { max-width: 640px; }
.modal-status { max-width: 480px; }
.modal-create { max-width: 520px; }

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-header h2 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1a2233;
}

.modal-close {
  background: none; border: none;
  font-size: 1.2rem; cursor: pointer;
  color: #6b7280; padding: .25rem;
  border-radius: 4px;
}
.modal-close:hover { background: #f3f4f6; }

.modal-body { padding: 1.25rem 1.5rem; }
.modal-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: .75rem;
}

/* ── Detail grid ───────────────────────────── */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: .9rem;
}

.detail-item { display: flex; flex-direction: column; gap: .2rem; }
.detail-item.full { grid-column: 1 / -1; }

.dl { font-size: .75rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .04em; }
.dv { font-size: .95rem; color: #1a2233; }
.dv.desc {
  background: #f8f9fa;
  padding: .6rem .85rem;
  border-radius: 6px;
  font-size: .88rem;
  line-height: 1.5;
  white-space: pre-wrap;
}

.items-list { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .3rem; }
.item-tag {
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 6px;
  padding: .2rem .6rem;
  font-size: .8rem;
  font-weight: 500;
}

/* ── Associated assets ────────────────────── */
.assets-list {
  display: flex;
  flex-wrap: wrap;
  gap: .5rem;
  margin-top: .4rem;
}

.asset-chip {
  display: flex;
  align-items: center;
  gap: .4rem;
  background: #eff6ff;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  padding: .4rem .7rem;
  font-size: .85rem;
}

.asset-chip-icon { font-size: 1.05rem; line-height: 1; }
.asset-chip-name { font-weight: 600; color: #1a2233; }
.asset-chip-type {
  font-size: .7rem;
  color: #6b7280;
  background: #fff;
  border-radius: 99px;
  padding: .05rem .5rem;
  border: 1px solid #e5e7eb;
}

.asset-monitor   { background: #fdf4ff; border-color: #f5d0fe; }
.asset-computer  { background: #eff6ff; border-color: #dbeafe; }
.asset-printer   { background: #fff7ed; border-color: #fed7aa; }
.asset-phone     { background: #f0fdf4; border-color: #bbf7d0; }

/* ── Asset picker (create modal) ──────────── */
.asset-picker {
  border: 1.5px solid #d1d5db;
  border-radius: 8px;
  overflow: hidden;
}

.asset-picker input[type="text"] {
  border: none;
  border-bottom: 1px solid #e5e7eb;
  border-radius: 0;
  width: 100%;
  padding: .5rem .7rem;
  font-size: .85rem;
  box-sizing: border-box;
}
.asset-picker input[type="text"]:focus { outline: none; }

.asset-picker-list {
  max-height: 160px;
  overflow-y: auto;
}

.asset-picker-item {
  display: flex;
  align-items: center;
  gap: .5rem;
  padding: .45rem .7rem;
  font-size: .85rem;
  cursor: pointer;
  border-bottom: 1px solid #f3f4f6;
}
.asset-picker-item:hover { background: #f9fafb; }
.asset-picker-item:last-child { border-bottom: none; }

.asset-picker-name { flex: 1; color: #1a2233; }
.asset-picker-type {
  font-size: .7rem;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 99px;
  padding: .05rem .5rem;
}

.asset-picker-empty {
  padding: .75rem;
  text-align: center;
  font-size: .8rem;
  color: #9ca3af;
}

.asset-picker-selected {
  padding: .4rem .7rem;
  font-size: .78rem;
  color: #1d4ed8;
  background: #eff6ff;
  border-top: 1px solid #e5e7eb;
}

.costs-table { width: 100%; border-collapse: collapse; font-size: .85rem; margin-top: .5rem; }
.costs-table th, .costs-table td {
  border: 1px solid #e5e7eb;
  padding: .4rem .6rem;
  text-align: left;
}
.costs-table th { background: #f3f4f6; font-weight: 600; }

/* ── Form ──────────────────────────────────── */
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: .35rem; font-weight: 600; font-size: .875rem; color: #374151; }
.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: .55rem .75rem;
  border: 1.5px solid #d1d5db;
  border-radius: 7px;
  font-size: .9rem;
  box-sizing: border-box;
  transition: border-color .15s;
}
.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.required { color: #ef4444; }

.status-change-info { margin-bottom: 1rem; color: #374151; }

.error-msg  { color: #dc2626; font-size: .85rem; margin-top: .5rem; }
.success-msg { color: #16a34a; font-size: .85rem; margin-top: .5rem; }

/* ── Buttons ───────────────────────────────── */
.btn-primary {
  background: #3b82f6; color: #fff;
  border: none; border-radius: 7px;
  padding: .55rem 1.25rem;
  font-size: .9rem; font-weight: 600;
  cursor: pointer; transition: background .15s;
}
.btn-primary:hover:not(:disabled) { background: #2563eb; }
.btn-primary:disabled { opacity: .6; cursor: not-allowed; }

.btn-secondary {
  background: #f3f4f6; color: #374151;
  border: 1.5px solid #d1d5db;
  border-radius: 7px;
  padding: .55rem 1.25rem;
  font-size: .9rem; font-weight: 600;
  cursor: pointer; transition: background .15s;
}
.btn-secondary:hover { background: #e5e7eb; }
</style>
