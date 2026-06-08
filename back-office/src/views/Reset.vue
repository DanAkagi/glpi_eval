<template>
  <div class="reset">
    <div class="container-fluid py-4">
      <div class="row justify-content-center">
        <div class="col-md-8 col-lg-6">
          <h1 class="h3 mb-2">
            <i class="bi bi-arrow-counterclockwise me-2"></i>Database Reset
          </h1>
          <p class="text-muted mb-4">Reset the database to its initial state</p>

          <div class="card shadow-sm">
            <div class="card-body">
              <div class="alert alert-warning border-warning">
                <h5 class="alert-heading">
                  <i class="bi bi-exclamation-triangle-fill me-2"></i>Warning
                </h5>
                <p class="mb-0">This action will delete all data from the database. This cannot be undone.</p>
              </div>

              <button @click="handleReset" class="btn btn-danger btn-lg w-100" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-trash3 me-2"></i>
                {{ loading ? 'Resetting...' : 'Reset Database' }}
              </button>

              <div v-if="error" class="alert alert-danger mt-3 mb-0">
                <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ error }}
              </div>
              <div v-if="success" class="alert alert-success mt-3 mb-0">
                <i class="bi bi-check-circle-fill me-2"></i>{{ success }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { resetApi } from '../services/api';

const loading = ref(false);
const error = ref('');
const success = ref('');

const handleReset = async () => {
  if (!confirm('Are you sure you want to reset the database? This action cannot be undone.')) {
    return;
  }

  loading.value = true;
  error.value = '';
  success.value = '';

  try {
    await resetApi.reset();
    success.value = 'Database reset successfully!';
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Failed to reset database';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
</style>
