<template>
  <div class="login-page">
    <div class="login-left">
      <div class="login-brand">
        <div class="brand-logo">
          <i class="bi bi-server"></i>
        </div>
        <h1>GLPI<br><span>Back-Office</span></h1>
      </div>
      <p class="login-tagline">Gestion centralisée de votre parc informatique</p>
      <ul class="login-features">
        <li><i class="bi bi-check-circle-fill"></i> Gestion des assets</li>
        <li><i class="bi bi-check-circle-fill"></i> Suivi des tickets</li>
        <li><i class="bi bi-check-circle-fill"></i> Import de données</li>
        <li><i class="bi bi-check-circle-fill"></i> Statistiques en temps réel</li>
      </ul>
    </div>

    <div class="login-right">
      <div class="login-card">
        <div class="login-card-header">
          <i class="bi bi-shield-lock-fill login-icon"></i>
          <h2>Accès sécurisé</h2>
          <p>Entrez votre code d'accès unique</p>
        </div>

        <form @submit.prevent="handleLogin" class="login-form">
          <div class="form-group">
            <label for="code">
              <i class="bi bi-key-fill me-1"></i>
              Code d'accès
            </label>
            <div class="input-wrapper">
              <input
                id="code"
                v-model="code"
                :type="showCode ? 'text' : 'password'"
                placeholder="••••••••"
                required
                autocomplete="off"
                class="form-control"
                :class="{ 'is-invalid': error }"
              />
              <button type="button" class="input-toggle" @click="showCode = !showCode" tabindex="-1">
                <i :class="showCode ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
            </div>
            <div class="invalid-feedback" v-if="error">{{ error }}</div>
          </div>

          <button type="submit" class="btn-login" :disabled="loading">
            <span v-if="loading">
              <span class="spinner-border spinner-border-sm me-2"></span>
              Connexion…
            </span>
            <span v-else>
              <i class="bi bi-box-arrow-in-right me-2"></i>
              Se connecter
            </span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authApi } from '../services/api';

const router = useRouter();
const code = ref('ADMIN123');
const loading = ref(false);
const error = ref('');
const showCode = ref(false);

onMounted(async () => {
  try {
    const response = await authApi.status();
    if (response.data.authenticated) router.push('/dashboard');
  } catch {}
});

const handleLogin = async () => {
  loading.value = true;
  error.value = '';
  try {
    await authApi.login(code.value);
    router.push('/dashboard');
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Code invalide. Veuillez réessayer.';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
}

.login-left {
  flex: 1;
  background: linear-gradient(145deg, #0f4c75 0%, #1b6ca8 50%, #0d7377 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 3rem;
  color: white;
  position: relative;
  overflow: hidden;
}

.login-left::before {
  content: '';
  position: absolute;
  width: 500px;
  height: 500px;
  border-radius: 50%;
  border: 80px solid rgba(255,255,255,0.04);
  top: -150px;
  right: -150px;
  pointer-events: none;
}

.login-left::after {
  content: '';
  position: absolute;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  border: 60px solid rgba(255,255,255,0.04);
  bottom: -80px;
  left: -80px;
  pointer-events: none;
}

.login-brand {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  margin-bottom: 2rem;
}

.brand-logo {
  width: 64px;
  height: 64px;
  background: rgba(255,255,255,0.15);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
}

.login-brand h1 {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.1;
  margin: 0;
}

.login-brand h1 span {
  font-size: 1rem;
  font-weight: 400;
  opacity: 0.7;
}

.login-tagline {
  font-size: 1rem;
  opacity: 0.75;
  margin-bottom: 2rem;
  max-width: 320px;
}

.login-features {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.login-features li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  opacity: 0.85;
}

.login-features li i {
  color: #14d9c4;
  font-size: 1rem;
}

.login-right {
  width: 420px;
  background: #f0f4f8;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.login-card {
  background: white;
  border-radius: 16px;
  padding: 2.5rem;
  width: 100%;
  box-shadow: 0 8px 32px rgba(15,76,117,0.12);
}

.login-card-header {
  text-align: center;
  margin-bottom: 2rem;
}

.login-icon {
  font-size: 2.5rem;
  color: #1b6ca8;
  margin-bottom: 0.75rem;
  display: block;
}

.login-card-header h2 {
  color: #0f4c75;
  font-weight: 700;
  font-size: 1.4rem;
  margin: 0 0 0.25rem;
}

.login-card-header p {
  color: #6c757d;
  font-size: 0.875rem;
  margin: 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group label {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.875rem;
  margin-bottom: 0.4rem;
  display: block;
}

.input-wrapper {
  position: relative;
}

.form-control {
  width: 100%;
  padding: 0.7rem 2.5rem 0.7rem 0.9rem;
  border: 2px solid #dee2e6;
  border-radius: 8px;
  font-size: 0.95rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-control:focus {
  outline: none;
  border-color: #1b6ca8;
  box-shadow: 0 0 0 3px rgba(27,108,168,0.12);
}

.form-control.is-invalid {
  border-color: #dc3545;
}

.invalid-feedback {
  color: #dc3545;
  font-size: 0.8rem;
  margin-top: 0.3rem;
}

.input-toggle {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 0;
  font-size: 1rem;
}

.input-toggle:hover { color: #1b6ca8; }

.btn-login {
  width: 100%;
  padding: 0.8rem;
  background: linear-gradient(135deg, #1b6ca8, #0d7377);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.btn-login:hover:not(:disabled) {
  opacity: 0.92;
  transform: translateY(-1px);
}

.btn-login:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .login-left { display: none; }
  .login-right { width: 100%; }
}
</style>