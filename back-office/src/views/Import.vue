<template>
  <div class="import">
    <div class="container-fluid py-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="h3">
          <i class="bi bi-upload me-2"></i>Import Data
        </h1>
      </div>
      <p class="text-muted mb-4">Upload CSV files and images to import data into the database</p>

      <div class="card shadow-sm">
        <div class="card-body">
          <!-- Individual Imports -->
          <div class="mb-5 pb-4 border-bottom">
            <h5 class="mb-3">
              <i class="bi bi-file-earmark-plus me-2"></i>Individual Imports
            </h5>
            <div class="row g-3">
              <div class="col-md-6 col-lg-3">
                <label class="form-label fw-bold">
                  <i class="bi bi-box-seam me-1"></i>Assets CSV
                </label>
                <input type="file" @change="(e) => handleFileSelect(e, 'assets')" accept=".csv" class="form-control mb-2" />
                <button @click="uploadAssets" :disabled="!files.assets || loading.assets" class="btn btn-primary w-100">
                  <span v-if="loading.assets" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-upload me-2"></i>
                  {{ loading.assets ? 'Uploading...' : 'Upload Assets' }}
                </button>
                <div v-if="results.assets" class="alert alert-success mt-2 mb-0 py-2">
                  <i class="bi bi-check-circle me-1"></i>Imported {{ results.assets }} assets
                </div>
              </div>

              <div class="col-md-6 col-lg-3">
                <label class="form-label fw-bold">
                  <i class="bi bi-ticket-detailed me-1"></i>Tickets CSV
                </label>
                <input type="file" @change="(e) => handleFileSelect(e, 'tickets')" accept=".csv" class="form-control mb-2" />
                <button @click="uploadTickets" :disabled="!files.tickets || loading.tickets" class="btn btn-primary w-100">
                  <span v-if="loading.tickets" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-upload me-2"></i>
                  {{ loading.tickets ? 'Uploading...' : 'Upload Tickets' }}
                </button>
                <div v-if="results.tickets" class="alert alert-success mt-2 mb-0 py-2">
                  <i class="bi bi-check-circle me-1"></i>Imported {{ results.tickets }} tickets
                </div>
              </div>

              <div class="col-md-6 col-lg-3">
                <label class="form-label fw-bold">
                  <i class="bi bi-currency-dollar me-1"></i>Costs CSV
                </label>
                <input type="file" @change="(e) => handleFileSelect(e, 'costs')" accept=".csv" class="form-control mb-2" />
                <button @click="uploadCosts" :disabled="!files.costs || loading.costs" class="btn btn-primary w-100">
                  <span v-if="loading.costs" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-upload me-2"></i>
                  {{ loading.costs ? 'Uploading...' : 'Upload Costs' }}
                </button>
                <div v-if="results.costs" class="alert alert-success mt-2 mb-0 py-2">
                  <i class="bi bi-check-circle me-1"></i>Imported {{ results.costs }} costs
                </div>
              </div>

              <div class="col-md-6 col-lg-3">
                <label class="form-label fw-bold">
                  <i class="bi bi-images me-1"></i>Images ZIP
                </label>
                <input type="file" @change="(e) => handleFileSelect(e, 'images')" accept=".zip" class="form-control mb-2" />
                <button @click="uploadImages" :disabled="!files.images || loading.images" class="btn btn-primary w-100">
                  <span v-if="loading.images" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-upload me-2"></i>
                  {{ loading.images ? 'Uploading...' : 'Upload Images' }}
                </button>
                <div v-if="results.images" class="alert alert-success mt-2 mb-0 py-2">
                  <i class="bi bi-check-circle me-1"></i>Imported {{ results.images }} images
                </div>
              </div>
            </div>
          </div>

          <!-- Transactional Import -->
          <div>
            <h5 class="mb-3">
              <i class="bi bi-layers me-2"></i>Transactional Import (All Files)
            </h5>
            <p class="text-muted mb-3">
              <i class="bi bi-info-circle me-1"></i>Upload all files at once. If any import fails, all changes will be rolled back.
            </p>
            <div class="row g-3 mb-3">
              <div class="col-md-6 col-lg-3">
                <label class="form-label fw-bold">
                  <i class="bi bi-box-seam me-1"></i>Assets CSV
                </label>
                <input type="file" @change="(e) => handleFileSelect(e, 'allAssets')" accept=".csv" class="form-control" />
              </div>
              <div class="col-md-6 col-lg-3">
                <label class="form-label fw-bold">
                  <i class="bi bi-ticket-detailed me-1"></i>Tickets CSV
                </label>
                <input type="file" @change="(e) => handleFileSelect(e, 'allTickets')" accept=".csv" class="form-control" />
              </div>
              <div class="col-md-6 col-lg-3">
                <label class="form-label fw-bold">
                  <i class="bi bi-currency-dollar me-1"></i>Costs CSV
                </label>
                <input type="file" @change="(e) => handleFileSelect(e, 'allCosts')" accept=".csv" class="form-control" />
              </div>
              <div class="col-md-6 col-lg-3">
                <label class="form-label fw-bold">
                  <i class="bi bi-images me-1"></i>Images ZIP
                </label>
                <input type="file" @change="(e) => handleFileSelect(e, 'allImages')" accept=".zip" class="form-control" />
              </div>
            </div>

            <button 
              @click="uploadAll" 
              :disabled="!allFilesReady || loading.all" 
              class="btn btn-teal btn-lg w-100"
            >
              <span v-if="loading.all" class="spinner-border spinner-border-sm me-2"></span>
              <i v-else class="bi bi-lightning-charge me-2"></i>
              {{ loading.all ? 'Importing...' : 'Import All' }}
            </button>

            <div v-if="allResults" class="alert alert-info mt-3">
              <h6 class="alert-heading">
                <i class="bi bi-check-circle me-2"></i>Import Results
              </h6>
              <div class="row g-2">
                <div class="col-md-3">
                  <i class="bi bi-box-seam me-1"></i>Assets: {{ allResults.assets }}
                </div>
                <div class="col-md-3">
                  <i class="bi bi-ticket-detailed me-1"></i>Tickets: {{ allResults.tickets }}
                </div>
                <div class="col-md-3">
                  <i class="bi bi-currency-dollar me-1"></i>Costs: {{ allResults.costs }}
                </div>
                <div class="col-md-3">
                  <i class="bi bi-images me-1"></i>Images: {{ allResults.images }}
                </div>
              </div>
            </div>
          </div>

          <div v-if="error" class="alert alert-danger mt-3">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { importApi } from '../services/api';

const files = ref<any>({});
const loading = ref<any>({});
const results = ref<any>({});
const allResults = ref<any>(null);
const error = ref('');

const allFilesReady = computed(() => {
  return files.value.allAssets && files.value.allTickets && files.value.allCosts && files.value.allImages;
});

const handleFileSelect = (event: Event, key: string) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    files.value[key] = target.files[0];
  }
};

const uploadAssets = async () => {
  loading.value.assets = true;
  error.value = '';
  
  try {
    const response = await importApi.assets(files.value.assets);
    results.value.assets = response.data.imported;
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to import assets';
  } finally {
    loading.value.assets = false;
  }
};

const uploadTickets = async () => {
  loading.value.tickets = true;
  error.value = '';
  
  try {
    const response = await importApi.tickets(files.value.tickets);
    results.value.tickets = response.data.imported;
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to import tickets';
  } finally {
    loading.value.tickets = false;
  }
};

const uploadCosts = async () => {
  loading.value.costs = true;
  error.value = '';
  
  try {
    const response = await importApi.costs(files.value.costs);
    results.value.costs = response.data.imported;
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to import costs';
  } finally {
    loading.value.costs = false;
  }
};

const uploadImages = async () => {
  loading.value.images = true;
  error.value = '';
  
  try {
    const response = await importApi.images(files.value.images);
    results.value.images = response.data.imported;
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to import images';
  } finally {
    loading.value.images = false;
  }
};

const uploadAll = async () => {
  loading.value.all = true;
  error.value = '';
  allResults.value = null;
  
  try {
    const response = await importApi.all({
      assets: files.value.allAssets,
      tickets: files.value.allTickets,
      costs: files.value.allCosts,
      images: files.value.allImages,
    });
    allResults.value = response.data.results;
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to import files';
  } finally {
    loading.value.all = false;
  }
};
</script>

<style scoped>
.btn-teal {
  background-color: #20c997;
  border-color: #20c997;
  color: white;
}

.btn-teal:hover:not(:disabled) {
  background-color: #1aa179;
  border-color: #1aa179;
  color: white;
}

.btn-teal:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
