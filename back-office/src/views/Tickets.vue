<template>
  <div class="tickets">
    <div class="container-fluid py-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="h3">
          <i class="bi bi-ticket-detailed me-2"></i>Tickets
        </h1>
      </div>

      <div v-if="loading" class="text-center py-5">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-3 text-muted">Loading tickets...</p>
      </div>

      <div v-else-if="tickets.length === 0" class="alert alert-info text-center">
        <i class="bi bi-info-circle me-2"></i>No tickets found
      </div>

      <div v-else class="card shadow-sm">
        <div class="card-body p-0">
          <div class="table-responsive">
            <table class="table table-hover mb-0">
              <thead class="bg-primary text-white">
                <tr>
                  <th>Ref</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="ticket in tickets" :key="ticket.id">
                  <td><strong>{{ ticket.ref_ticket }}</strong></td>
                  <td>{{ ticket.date }}</td>
                  <td>{{ ticket.type }}</td>
                  <td>{{ ticket.titre }}</td>
                  <td><span class="badge bg-info">{{ ticket.status }}</span></td>
                  <td><span class="badge bg-warning text-dark">{{ ticket.priority }}</span></td>
                  <td>
                    <button @click="viewTicket(ticket.id)" class="btn btn-sm btn-primary">
                      <i class="bi bi-eye me-1"></i>View
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Ticket Detail Modal -->
      <div v-if="selectedTicket" class="modal fade show d-block" tabindex="-1" @click="closeModal">
        <div class="modal-dialog modal-lg" @click.stop>
          <div class="modal-content">
            <div class="modal-header bg-primary text-white">
              <h5 class="modal-title">
                <i class="bi bi-ticket-detailed me-2"></i>Ticket #{{ selectedTicket.ref_ticket }}
              </h5>
              <button type="button" class="btn-close btn-close-white" @click="closeModal"></button>
            </div>
            <div class="modal-body">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="fw-bold text-muted">Date:</label>
                  <div>{{ selectedTicket.date }} {{ selectedTicket.heure }}</div>
                </div>
                <div class="col-md-6">
                  <label class="fw-bold text-muted">Type:</label>
                  <div>{{ selectedTicket.type }}</div>
                </div>
                <div class="col-12">
                  <label class="fw-bold text-muted">Title:</label>
                  <div>{{ selectedTicket.titre }}</div>
                </div>
                <div class="col-12">
                  <label class="fw-bold text-muted">Description:</label>
                  <div>{{ selectedTicket.description || 'N/A' }}</div>
                </div>
                <div class="col-md-6">
                  <label class="fw-bold text-muted">Status:</label>
                  <div><span class="badge bg-info">{{ selectedTicket.status }}</span></div>
                </div>
                <div class="col-md-6">
                  <label class="fw-bold text-muted">Priority:</label>
                  <div><span class="badge bg-warning text-dark">{{ selectedTicket.priority }}</span></div>
                </div>
                <div class="col-12">
                  <label class="fw-bold text-muted">Associated Assets:</label>
                  <div v-if="!selectedTicket.items || selectedTicket.items === '[]'" class="text-muted">No assets</div>
                  <div v-else class="alert alert-secondary">{{ selectedTicket.items }}</div>
                </div>
                <div class="col-12" v-if="selectedTicket.costs && selectedTicket.costs.length > 0">
                  <label class="fw-bold text-muted">Costs:</label>
                  <div class="list-group mt-2">
                    <div v-for="(cost, index) in selectedTicket.costs" :key="index" class="list-group-item d-flex justify-content-between align-items-center">
                      <span><i class="bi bi-clock me-2"></i>{{ cost.duration_second }}s</span>
                      <span><i class="bi bi-currency-dollar me-2"></i>{{ cost.time_cost }}</span>
                      <span><i class="bi bi-tag me-2"></i>{{ cost.fixed_cost }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" @click="closeModal">
                <i class="bi bi-x-lg me-2"></i>Close
              </button>
            </div>
          </div>
        </div>
      </div>
      <div v-if="selectedTicket" class="modal-backdrop fade show"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ticketsApi } from '../services/api';

const tickets = ref<any[]>([]);
const loading = ref(true);
const selectedTicket = ref<any>(null);

onMounted(async () => {
  try {
    const response = await ticketsApi.getAll();
    tickets.value = response.data;
  } catch (error) {
    console.error('Failed to load tickets:', error);
  } finally {
    loading.value = false;
  }
});

const viewTicket = async (id: number) => {
  try {
    const response = await ticketsApi.getById(id.toString());
    selectedTicket.value = response.data;
  } catch (error) {
    console.error('Failed to load ticket:', error);
  }
};

const closeModal = () => {
  selectedTicket.value = null;
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 1040;
}
</style>
