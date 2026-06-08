<template>
  <div class="asset-detail">
    <div class="container-fluid py-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="h3">
          <i class="bi bi-box-seam me-2"></i>Asset Details
        </h1>
        <button @click="goBack" class="btn btn-secondary">
          <i class="bi bi-arrow-left me-2"></i>Back
        </button>
      </div>

      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3 text-muted">Loading asset details...</p>
      </div>

      <div v-else-if="error" class="alert alert-danger">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
      </div>

      <div v-else-if="asset" class="row g-4">
        <div class="col-lg-8">
          <div class="card shadow-sm mb-4">
            <div class="card-header bg-primary text-white">
              <h5 class="mb-0">
                <i class="bi bi-images me-2"></i>Asset Images
              </h5>
            </div>
            <div class="card-body">
              <div v-if="loadingImages" class="text-center py-3">
                <div class="spinner-border spinner-border-sm text-primary" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
              </div>
              <div v-else-if="images.length === 0" class="text-center text-muted py-3">
                <i class="bi bi-image me-2"></i>No images available
              </div>
              <div v-else class="row g-3">
                <div v-for="image in images" :key="image.id" class="col-md-4 col-sm-6">
                  <div class="card">
                    <img :src="image.download_url" :alt="image.filename" class="card-img-top" @error="handleImageError" />
                    <div class="card-body p-2">
                      <small class="text-muted text-truncate d-block">{{ image.filename }}</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="card shadow-sm">
            <div class="card-header bg-primary text-white">
              <h5 class="mb-0">
                <i class="bi bi-info-circle me-2"></i>Asset Information
              </h5>
            </div>
            <div class="card-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="fw-bold text-muted">ID:</label>
                  <div>{{ asset.id }}</div>
                </div>
                <div class="col-md-6">
                  <label class="fw-bold text-muted">Name:</label>
                  <div><strong>{{ asset.name }}</strong></div>
                </div>
                <div class="col-md-6">
                  <label class="fw-bold text-muted">Type:</label>
                  <div><span class="badge bg-teal">{{ asset.item_type }}</span></div>
                </div>
                <div class="col-md-6">
                  <label class="fw-bold text-muted">Status:</label>
                  <div><span class="badge bg-info">{{ asset.status }}</span></div>
                </div>
                <div class="col-md-6">
                  <label class="fw-bold text-muted">Location:</label>
                  <div>{{ asset.location || 'N/A' }}</div>
                </div>
                <div class="col-md-6">
                  <label class="fw-bold text-muted">Manufacturer:</label>
                  <div>{{ asset.manufacturer || 'N/A' }}</div>
                </div>
                <div class="col-md-6">
                  <label class="fw-bold text-muted">Model:</label>
                  <div>{{ asset.model || 'N/A' }}</div>
                </div>
                <div class="col-md-6">
                  <label class="fw-bold text-muted">Inventory Number:</label>
                  <div>{{ asset.inventory_number || 'N/A' }}</div>
                </div>
                <div class="col-md-6">
                  <label class="fw-bold text-muted">User:</label>
                  <div>{{ asset.user || 'N/A' }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="card shadow-sm">
            <div class="card-header bg-teal text-white">
              <h5 class="mb-0">
                <i class="bi bi-lightning me-2"></i>Quick Actions
              </h5>
            </div>
            <div class="card-body">
              <div class="d-grid gap-2">
                <button class="btn btn-outline-primary">
                  <i class="bi bi-pencil me-2"></i>Edit Asset
                </button>
                <button class="btn btn-outline-info">
                  <i class="bi bi-clock-history me-2"></i>View History
                </button>
                <button class="btn btn-outline-warning">
                  <i class="bi bi-ticket-detailed me-2"></i>View Related Tickets
                </button>
                <button class="btn btn-outline-danger">
                  <i class="bi bi-trash me-2"></i>Delete Asset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { assetsApi, documentsApi } from '../services/api';

const route = useRoute();
const router = useRouter();
const asset = ref<any>(null);
const loading = ref(true);
const loadingImages = ref(false);
const images = ref<any[]>([]);
const error = ref('');

const loadAsset = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    const id = route.params.id as string;
    const itemType = route.params.itemType as string;
    
    // Try to get asset by type and id
    const response = await assetsApi.getById(`${itemType}/${id}`);
    asset.value = response.data;
    
    // Load images for this asset
    await loadImages();
  } catch (err: any) {
    // Fallback: try to get by id only (legacy route)
    try {
      const id = route.params.id as string;
      const response = await assetsApi.getById(id);
      asset.value = response.data;
      await loadImages();
    } catch (fallbackErr) {
      error.value = err.response?.data?.error || 'Failed to load asset';
    }
  } finally {
    loading.value = false;
  }
};

const loadImages = async () => {
  if (!asset.value) return;
  
  loadingImages.value = true;
  try {
    // Construct local image URLs based on asset name/ID
    // Images are saved with pattern like "PC-ADM-001.png" or "42.png"
    const possibleFilenames = [
      `${asset.value.name}.png`,
      `${asset.value.name}.jpg`,
      `${asset.value.name}.jpeg`,
      `${asset.value.id}.png`,
      `${asset.value.id}.jpg`,
      `${asset.value.id}.jpeg`
    ];
    
    // Filter to only include images that actually exist
    images.value = [];
    for (const filename of possibleFilenames) {
      try {
        const response = await fetch(`http://localhost:3001/images/${filename}`, { method: 'HEAD' });
        if (response.ok) {
          images.value.push({
            id: filename,
            filename: filename,
            download_url: `http://localhost:3001/images/${filename}`
          });
        }
      } catch (error) {
        // Image doesn't exist, skip it
      }
    }
  } catch (error) {
    images.value = [];
  } finally {
    loadingImages.value = false;
  }
};

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.style.display = 'none';
};

const goBack = () => {
  router.push('/assets');
};

onMounted(() => {
  loadAsset();
});
</script>

<style scoped>
.bg-teal {
  background-color: #20c997 !important;
}
</style>
