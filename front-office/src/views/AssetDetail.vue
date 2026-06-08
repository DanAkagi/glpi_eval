<template>
  <div class="asset-detail">
    <div class="assets-header">
      <h1>Asset Details</h1>
      <button @click="goBack" class="back-btn">
        <i class="bi bi-arrow-left"></i> Back
      </button>
    </div>

    <div v-if="loading" class="loading">
      Loading asset details...
    </div>

    <div v-else-if="error" class="error">
      {{ error }}
    </div>

    <div v-else-if="asset" class="asset-content">
      <!-- Images Section -->
      <div class="section">
        <h2>Asset Images</h2>
        <div v-if="loadingImages" class="loading">Loading images...</div>
        <div v-else-if="images.length === 0" class="empty">No images available</div>
        <div v-else class="images-grid">
          <div v-for="image in images" :key="image.id" class="image-card">
            <img :src="image.download_url" :alt="image.filename" @error="handleImageError" />
            <div class="image-caption">{{ image.filename }}</div>
          </div>
        </div>
      </div>

      <!-- Information Section -->
      <div class="section">
        <h2>Asset Information</h2>
        <div class="info-grid">
          <div class="info-item">
            <label>ID:</label>
            <span>{{ asset.id || 'N/A' }}</span>
          </div>
          <div class="info-item">
            <label>Name:</label>
            <span><strong>{{ asset.name || 'N/A' }}</strong></span>
          </div>
          <div class="info-item">
            <label>Type:</label>
            <span>{{ asset.item_type || 'N/A' }}</span>
          </div>
          <div class="info-item">
            <label>Status:</label>
            <span>{{ asset.status || 'N/A' }}</span>
          </div>
          <div class="info-item">
            <label>Location:</label>
            <span>{{ asset.location || 'N/A' }}</span>
          </div>
          <div class="info-item">
            <label>Manufacturer:</label>
            <span>{{ asset.manufacturer || 'N/A' }}</span>
          </div>
          <div class="info-item">
            <label>Model:</label>
            <span>{{ asset.model || 'N/A' }}</span>
          </div>
          <div class="info-item">
            <label>Inventory #:</label>
            <span>{{ asset.inventory_number || 'N/A' }}</span>
          </div>
          <div class="info-item">
            <label>User:</label>
            <span>{{ asset.user || 'N/A' }}</span>
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
      console.log(`Data: $asset.value`);
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
.asset-detail {
  padding: 2rem;
}

.assets-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.assets-header h1 {
  margin: 0;
  color: #2c3e50;
}

.back-btn {
  padding: 0.5rem 1rem;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.back-btn:hover {
  background-color: #2980b9;
}

.loading,
.error,
.empty {
  text-align: center;
  padding: 2rem;
  color: #7f8c8d;
}

.error {
  color: #e74c3c;
}

.asset-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.section h2 {
  margin: 0 0 1.5rem 0;
  color: #2c3e50;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.image-card {
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.image-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
}

.image-caption {
  padding: 0.5rem;
  font-size: 0.875rem;
  color: #7f8c8d;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.info-item label {
  font-weight: 500;
  color: #7f8c8d;
  font-size: 0.875rem;
}

.info-item span {
  color: #2c3e50;
}
</style>
