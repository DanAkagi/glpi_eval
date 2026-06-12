<template>
  <div class="kanban-settings">
    <div class="page-header">
      <h1><i class="bi bi-kanban-fill me-2"></i>Paramètres Kanban</h1>
      <p class="page-subtitle">Personnalisez les colonnes du tableau Kanban du Front-Office</p>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-3 text-muted">Chargement de la configuration…</p>
    </div>

    <div v-else class="settings-content">
      <!-- Preview -->
      <div class="preview-section">
        <h2 class="section-title"><i class="bi bi-eye me-2"></i>Aperçu du tableau</h2>
        <div class="kanban-preview">
          <div
            v-for="col in editColumns"
            :key="col.id"
            class="preview-col"
            :style="{ background: col.color }"
          >
            <div class="preview-col-header">
              <div>
                <div class="preview-label-mg">{{ col.labelMg || '…' }}</div>
                <div class="preview-label-en">({{ col.label }})</div>
              </div>
              <span class="preview-count">0</span>
            </div>
            <div class="preview-card">Exemple de ticket</div>
            <div class="preview-card">Exemple de ticket</div>
          </div>
        </div>
      </div>

      <!-- Config form -->
      <div class="config-section">
        <h2 class="section-title"><i class="bi bi-sliders me-2"></i>Configuration des colonnes</h2>

        <div class="columns-grid">
          <div v-for="col in editColumns" :key="col.id" class="col-card">
            <div class="col-card-header" :style="{ background: col.color }">
              <span class="col-id-badge">{{ col.label }}</span>
            </div>
            <div class="col-card-body">
              <div class="field-group">
                <label>Nom en malgache</label>
                <input v-model="col.labelMg" type="text" :placeholder="`Ex: ${defaultLabelMg(col.id)}`" />
              </div>
              <div class="field-group">
                <label>Couleur de fond</label>
                <div class="color-input-wrap">
                  <input type="color" v-model="col.color" class="color-picker" />
                  <input type="text" v-model="col.color" class="color-text" placeholder="#ffffff" />
                </div>
              </div>
              <div class="color-presets">
                <span class="presets-label">Préréglages :</span>
                <div class="presets-row">
                  <button
                    v-for="preset in COLOR_PRESETS"
                    :key="preset.color"
                    class="preset-btn"
                    :style="{ background: preset.color }"
                    :title="preset.name"
                    @click="col.color = preset.color"
                  ></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p v-if="saveError" class="alert alert-danger mt-3">{{ saveError }}</p>
        <p v-if="saveSuccess" class="alert alert-success mt-3">{{ saveSuccess }}</p>

        <div class="form-actions">
          <button class="btn btn-outline-secondary" @click="resetToDefault">
            <i class="bi bi-arrow-counterclockwise me-2"></i>Réinitialiser
          </button>
          <button class="btn btn-primary" :disabled="saving" @click="save">
            <i class="bi bi-save me-2"></i>{{ saving ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { kanbanApi } from '../services/api';

// ── State ─────────────────────────────────────
const loading = ref(true);
const saving = ref(false);
const saveError = ref('');
const saveSuccess = ref('');

const editColumns = ref<any[]>([]);

const DEFAULT_COLUMNS = [
  { id: 'new',         label: 'New',         labelMg: 'Vaovao',    color: '#e3f2fd' },
  { id: 'in_progress', label: 'In Progress',  labelMg: 'Efa manao', color: '#fff8e1' },
  { id: 'closed',      label: 'Closed',       labelMg: 'Vita',      color: '#e8f5e9' },
];

const COLOR_PRESETS = [
  { name: 'Bleu clair',  color: '#e3f2fd' },
  { name: 'Jaune clair', color: '#fff8e1' },
  { name: 'Vert clair',  color: '#e8f5e9' },
  { name: 'Rose clair',  color: '#fce4ec' },
  { name: 'Violet clair', color: '#f3e5f5' },
  { name: 'Orange clair', color: '#fff3e0' },
  { name: 'Gris clair',  color: '#f5f5f5' },
  { name: 'Cyan clair',  color: '#e0f7fa' },
];

// ── Init ──────────────────────────────────────
onMounted(async () => {
  try {
    const res = await kanbanApi.getConfig();
    editColumns.value = res.data.columns.map((c: any) => ({ ...c }));
  } catch {
    editColumns.value = DEFAULT_COLUMNS.map(c => ({ ...c }));
  } finally {
    loading.value = false;
  }
});

// ── Actions ───────────────────────────────────
async function save() {
  saving.value = true;
  saveError.value = '';
  saveSuccess.value = '';

  // Validate
  for (const col of editColumns.value) {
    if (!col.labelMg?.trim()) {
      saveError.value = `Le nom malgache de "${col.label}" est obligatoire.`;
      saving.value = false;
      return;
    }
    if (!col.color?.match(/^#[0-9a-fA-F]{6}$/)) {
      saveError.value = `La couleur de "${col.label}" doit être au format #RRGGBB.`;
      saving.value = false;
      return;
    }
  }

  try {
    await kanbanApi.updateConfig({ columns: editColumns.value });
    saveSuccess.value = 'Configuration enregistrée avec succès !';
    setTimeout(() => { saveSuccess.value = ''; }, 3000);
  } catch {
    saveError.value = 'Erreur lors de l\'enregistrement.';
  } finally {
    saving.value = false;
  }
}

function resetToDefault() {
  editColumns.value = DEFAULT_COLUMNS.map(c => ({ ...c }));
  saveSuccess.value = '';
  saveError.value = '';
}

function defaultLabelMg(id: string) {
  const map: Record<string, string> = { new: 'Vaovao', in_progress: 'Efa manao', closed: 'Vita' };
  return map[id] || '';
}
</script>

<style scoped>
.kanban-settings {
  padding: 2rem;
  max-width: 1100px;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1a2233;
  margin-bottom: .3rem;
}

.page-subtitle {
  color: #6b7280;
  font-size: .95rem;
  margin: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem;
}

/* ── Preview ──────────────────────────── */
.preview-section, .config-section {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0,0,0,.07);
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.05rem;
  font-weight: 700;
  color: #1a2233;
  margin-bottom: 1.25rem;
}

.kanban-preview {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
}

.preview-col {
  flex: 1;
  min-width: 180px;
  border-radius: 10px;
  padding: .85rem;
  transition: background .3s;
}

.preview-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: .75rem;
}

.preview-label-mg {
  font-size: .9rem;
  font-weight: 700;
  color: #1a2233;
}

.preview-label-en {
  font-size: .72rem;
  color: #6b7280;
}

.preview-count {
  background: rgba(0,0,0,.12);
  border-radius: 99px;
  font-size: .75rem;
  font-weight: 700;
  padding: .1rem .45rem;
}

.preview-card {
  background: #fff;
  border-radius: 6px;
  padding: .6rem .7rem;
  margin-bottom: .5rem;
  font-size: .8rem;
  color: #6b7280;
  box-shadow: 0 1px 3px rgba(0,0,0,.07);
  border-left: 3px solid #3b82f6;
}

/* ── Config grid ──────────────────────── */
.columns-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 768px) {
  .columns-grid { grid-template-columns: 1fr; }
}

.col-card {
  border: 1.5px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}

.col-card-header {
  padding: .75rem 1rem;
  transition: background .3s;
}

.col-id-badge {
  font-size: .85rem;
  font-weight: 700;
  color: #1a2233;
}

.col-card-body {
  padding: 1rem;
}

.field-group {
  margin-bottom: .85rem;
}

.field-group label {
  display: block;
  font-size: .8rem;
  font-weight: 600;
  color: #374151;
  margin-bottom: .3rem;
}

.field-group input[type="text"] {
  width: 100%;
  padding: .45rem .65rem;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  font-size: .88rem;
  box-sizing: border-box;
  transition: border-color .15s;
}

.field-group input[type="text"]:focus {
  outline: none;
  border-color: #3b82f6;
}

.color-input-wrap {
  display: flex;
  align-items: center;
  gap: .5rem;
}

.color-picker {
  width: 42px; height: 36px;
  padding: 2px;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  flex-shrink: 0;
}

.color-text {
  flex: 1;
  padding: .45rem .65rem;
  border: 1.5px solid #d1d5db;
  border-radius: 6px;
  font-size: .85rem;
  font-family: monospace;
}

.color-text:focus {
  outline: none;
  border-color: #3b82f6;
}

.color-presets {
  margin-top: .5rem;
}

.presets-label {
  font-size: .75rem;
  color: #6b7280;
  display: block;
  margin-bottom: .35rem;
}

.presets-row {
  display: flex;
  flex-wrap: wrap;
  gap: .35rem;
}

.preset-btn {
  width: 24px; height: 24px;
  border: 2px solid #d1d5db;
  border-radius: 4px;
  cursor: pointer;
  transition: transform .15s, border-color .15s;
  padding: 0;
}

.preset-btn:hover {
  transform: scale(1.2);
  border-color: #3b82f6;
}

/* ── Actions ──────────────────────────── */
.form-actions {
  display: flex;
  gap: .75rem;
  justify-content: flex-end;
}
</style>
