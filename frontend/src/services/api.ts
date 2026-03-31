import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  AdminManagedSession,
  User,
  AuthResponse,
  RegisterResponse,
  Call,
  CallQualitySample,
  AdminCallQualityHistory,
  AdminUser,
  AdminSecurityEvent,
  ModeratorCallFlagsPage,
  AdminSlaSummary,
  AdminTrafficLog,
  AdminUserDetail,
  ModeratorPresenceSnapshot,
} from '../types';

const apiBaseUrlRaw = process.env.REACT_APP_API_URL?.trim();
const API_BASE_URL = (() => {
  if (!apiBaseUrlRaw) return '/api/v1';
  const normalized = apiBaseUrlRaw.replace(/\/+$/, '');
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
})();

class ApiService {
  private api: AxiosInstance;
  private token: string | null = null;
  private refreshTokenValue: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 15000,
    });

    this.api.interceptors.request.use((config) => {
      if (this.token) {
        config.headers = config.headers || {};
        (config.headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
      }
      return config;
    });

    this.token = localStorage.getItem('accessToken');
    this.refreshTokenValue = localStorage.getItem('refreshToken');
    this.setAuthHeader();
  }

  private setAuthHeader() {
    if (this.token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    } else {
      delete this.api.defaults.headers.common['Authorization'];
    }
  }

  private persistTokens(accessToken: string, refreshToken?: string) {
    this.token = accessToken;
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      this.refreshTokenValue = refreshToken;
      localStorage.setItem('refreshToken', refreshToken);
    }
    this.setAuthHeader();
  }

  getRefreshToken(): string | null {
    return this.refreshTokenValue;
  }

  getAccessToken(): string | null {
    return this.token;
  }

  // Auth endpoints
  async register(username: string, password: string): Promise<RegisterResponse> {
    const response = await this.api.post<RegisterResponse>('/auth/register', {
      username,
      password,
    });
    return response.data;
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await this.api.post<AuthResponse>('/auth/login', {
      username,
      password,
    });

    this.persistTokens(response.data.accessToken, response.data.refreshToken);
    return response.data;
  }

  async refreshAuth(): Promise<AuthResponse> {
    if (!this.refreshTokenValue) {
      throw new Error('No refresh token');
    }
    const response = await this.api.post<AuthResponse>('/auth/refresh', {
      refreshToken: this.refreshTokenValue,
    });
    this.persistTokens(response.data.accessToken, response.data.refreshToken);
    return response.data;
  }

  async logoutRequest(allDevices = false): Promise<{ success: boolean; revoked?: number }> {
    const response = await this.api.post<{ success: boolean; revoked?: number }>('/auth/logout', {
      refreshToken: this.refreshTokenValue,
      allDevices,
    });
    return response.data;
  }

  async requestVerifyCode(): Promise<any> {
    const response = await this.api.post('/auth/verify/request', {});
    return response.data;
  }

  async verifyCode(code: string): Promise<any> {
    const response = await this.api.post('/auth/verify', { code });
    return response.data;
  }

  async forgotPassword(identifier: string): Promise<any> {
    const response = await this.api.post('/auth/forgot-password', { identifier });
    return response.data;
  }

  async resetPassword(identifier: string, code: string, newPassword: string): Promise<any> {
    const response = await this.api.post('/auth/reset-password', {
      identifier,
      code,
      newPassword,
    });
    return response.data;
  }

  async getMe(): Promise<User> {
    const response = await this.api.get<User>('/auth/me');
    return response.data;
  }

  logout(): void {
    this.token = null;
    this.refreshTokenValue = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    delete this.api.defaults.headers.common['Authorization'];
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  // User endpoints
  async getUsers(): Promise<User[]> {
    const response = await this.api.get<User[]>('/users');
    return response.data;
  }

  async getUser(id: string): Promise<User> {
    const response = await this.api.get<User>(`/users/${id}`);
    return response.data;
  }

  async getSessions(): Promise<any[]> {
    const response = await this.api.get<any[]>('/users/me/sessions', {
      params: { _ts: Date.now() },
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    return response.data;
  }

  async terminateSession(id: string): Promise<{ success: boolean; revoked?: number }> {
    const response = await this.api.delete<{ success: boolean; revoked?: number }>(`/users/me/sessions/${id}`);
    return response.data;
  }

  async getSecurityActivity(): Promise<any[]> {
    const response = await this.api.get<any[]>('/users/me/security-activity', {
      params: { _ts: Date.now() },
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
    return response.data;
  }

  // Call endpoints
  async createCall(calleeId: string): Promise<Call> {
    const response = await this.api.post<Call>('/calls', {
      calleeId,
    });
    return response.data;
  }

  async getCall(id: string): Promise<Call> {
    const response = await this.api.get<Call>(`/calls/${id}`);
    return response.data;
  }

  async endCall(id: string): Promise<Call> {
    const response = await this.api.post<Call>(`/calls/${id}/end`, {});
    return response.data;
  }

  async acceptCall(id: string): Promise<Call> {
    const response = await this.api.post<Call>(`/calls/${id}/accept`, {});
    return response.data;
  }

  async rejectCall(id: string): Promise<Call> {
    const response = await this.api.post<Call>(`/calls/${id}/reject`, {});
    return response.data;
  }

  async markCallActive(id: string): Promise<Call> {
    const response = await this.api.post<Call>(`/calls/${id}/active`, {});
    return response.data;
  }

  async getPendingCallMe(): Promise<Call | null> {
    const response = await this.api.get<Call | null>('/calls/pending/me');
    return response.data;
  }

  async getActiveCallMe(): Promise<Call | null> {
    const response = await this.api.get<Call | null>('/calls/active/me');
    return response.data;
  }

  async getCallHistory(): Promise<any[]> {
    const response = await this.api.get<any[]>('/calls/history');
    return response.data;
  }

  async getLiveCall(): Promise<any> {
    const response = await this.api.get('/calls/live');
    return response.data;
  }

  async submitCallQuality(id: string, sample: CallQualitySample): Promise<{ success: boolean }> {
    const response = await this.api.post<{ success: boolean }>(`/calls/${id}/quality`, sample);
    return response.data;
  }

  async checkNumber(phoneNumber: string): Promise<any> {
    const response = await this.api.post('/calls/check-number', { phoneNumber });
    return response.data;
  }

  async reportNumber(phoneNumber: string, description?: string): Promise<any> {
    const response = await this.api.post('/calls/report', { phoneNumber, description });
    return response.data;
  }

  // Risk endpoints
  async getRiskAnalysis(): Promise<any> {
    const response = await this.api.get('/risk/analysis');
    return response.data;
  }

  async getRiskMonitor(): Promise<any> {
    const response = await this.api.get('/risk/monitor');
    return response.data;
  }

  async getRiskStats(): Promise<any> {
    const response = await this.api.get('/risk/stats');
    return response.data;
  }

  // Blacklist endpoints
  async getBlacklist(): Promise<any[]> {
    const response = await this.api.get<any[]>('/blacklist');
    return response.data;
  }

  async addBlacklist(phoneNumber: string, reason?: string): Promise<any> {
    const response = await this.api.post('/blacklist', { phoneNumber, reason });
    return response.data;
  }

  async removeBlacklist(id: string): Promise<any> {
    const response = await this.api.delete(`/blacklist/${id}`);
    return response.data;
  }

  // Admin endpoints
  async getAdminDashboard(): Promise<any> {
    const response = await this.api.get('/admin/dashboard');
    return response.data;
  }

  async getAdminUsers(): Promise<AdminUser[]> {
    const response = await this.api.get<AdminUser[]>('/admin/users');
    return response.data;
  }

  async getAdminUserDetail(id: string): Promise<AdminUserDetail> {
    const response = await this.api.get<AdminUserDetail>(`/admin/users/${id}/detail`);
    return response.data;
  }

  async updateUserRole(id: string, role: 'user' | 'admin' | 'moderator'): Promise<any> {
    const response = await this.api.put(`/admin/users/${id}/role`, { role });
    return response.data;
  }

  async resetAdminUserPassword(id: string, newPassword: string): Promise<{ success: boolean; userId: string; revoked: number }> {
    const response = await this.api.post<{ success: boolean; userId: string; revoked: number }>(
      `/admin/users/${id}/reset-password`,
      { newPassword },
    );
    return response.data;
  }

  async revokeAdminUserSessions(id: string): Promise<{ success: boolean; userId: string; revoked: number }> {
    const response = await this.api.post<{ success: boolean; userId: string; revoked: number }>(
      `/admin/users/${id}/revoke-sessions`,
      {},
    );
    return response.data;
  }

  async revokeAdminUserSession(id: string, sessionId: string): Promise<{ success: boolean; userId: string; sessionId: string; revoked: number }> {
    const response = await this.api.post<{ success: boolean; userId: string; sessionId: string; revoked: number }>(
      `/admin/users/${id}/sessions/${sessionId}/revoke`,
      {},
    );
    return response.data;
  }

  async deleteAdminUser(id: string): Promise<{ success: boolean }> {
    const response = await this.api.delete<{ success: boolean }>(`/admin/users/${id}`);
    return response.data;
  }

  async getAdminCalls(): Promise<any[]> {
    const response = await this.api.get<any[]>('/admin/calls');
    return response.data;
  }

  async getModeratorOverview(): Promise<any> {
    const response = await this.api.get('/admin/moderation/overview');
    return response.data;
  }

  async getModeratorPresence(): Promise<ModeratorPresenceSnapshot> {
    const response = await this.api.get<ModeratorPresenceSnapshot>('/admin/moderation/presence');
    return response.data;
  }

  async getAdminCallQualityHistory(id: string, limit = 120): Promise<AdminCallQualityHistory> {
    const response = await this.api.get<AdminCallQualityHistory>(`/admin/calls/${id}/quality-history`, {
      params: { limit },
    });
    return response.data;
  }

  async forceEndAdminCall(id: string): Promise<{ success: boolean; callId: string; status: string; endedAt?: string }> {
    const response = await this.api.post<{ success: boolean; callId: string; status: string; endedAt?: string }>(
      `/admin/calls/${id}/force-end`,
      {},
    );
    return response.data;
  }

  async flagAdminCall(id: string, reason?: string): Promise<{ success: boolean; callId: string; status: string; reason: string }> {
    const response = await this.api.post<{ success: boolean; callId: string; status: string; reason: string }>(
      `/admin/calls/${id}/flag`,
      { reason },
    );
    return response.data;
  }

  async getAdminCallFlags(
    status: 'open' | 'resolved' | 'all' = 'open',
    limit = 100,
    offset = 0,
    q = '',
    sortBy: 'createdAt' | 'status' | 'actorRole' = 'createdAt',
    sortDir: 'asc' | 'desc' = 'desc',
  ): Promise<ModeratorCallFlagsPage> {
    const response = await this.api.get<ModeratorCallFlagsPage>('/admin/calls/flags', {
      params: { status, limit, offset, q, sortBy, sortDir },
    });
    return response.data;
  }

  async resolveAdminCallFlag(flagId: string): Promise<{ success: boolean; flagId: string; status: string }> {
    const response = await this.api.post<{ success: boolean; flagId: string; status: string }>(
      `/admin/calls/flags/${flagId}/resolve`,
      {},
    );
    return response.data;
  }

  async resolveAllAdminCallFlags(callId: string): Promise<{ success: boolean; callId: string; resolved: number }> {
    const response = await this.api.post<{ success: boolean; callId: string; resolved: number }>(
      `/admin/calls/${callId}/flags/resolve-all`,
      {},
    );
    return response.data;
  }

  async getAdminReports(): Promise<any> {
    const response = await this.api.get('/admin/reports');
    return response.data;
  }

  async getAdminAnalytics(): Promise<any> {
    const response = await this.api.get('/admin/analytics');
    return response.data;
  }

  async getAdminSlaSummary(): Promise<AdminSlaSummary> {
    const response = await this.api.get<AdminSlaSummary>('/admin/sla-summary');
    return response.data;
  }

  async getAdminSystemLogs(): Promise<any[]> {
    const response = await this.api.get<any[]>('/admin/system-logs');
    return response.data;
  }

  async getAdminBlacklist(): Promise<any[]> {
    const response = await this.api.get<any[]>('/admin/blacklist');
    return response.data;
  }

  async getAdminSessions(limit = 300): Promise<AdminManagedSession[]> {
    const response = await this.api.get<AdminManagedSession[]>('/admin/sessions', {
      params: { limit },
    });
    return response.data;
  }

  async getAdminSecurityActivity(limit = 400): Promise<AdminSecurityEvent[]> {
    const response = await this.api.get<AdminSecurityEvent[]>('/admin/security-activity', {
      params: { limit },
    });
    return response.data;
  }

  async getAdminTrafficLogs(limit = 400): Promise<AdminTrafficLog[]> {
    const response = await this.api.get<AdminTrafficLog[]>('/admin/traffic-logs', {
      params: { limit },
    });
    return response.data;
  }

  // ML endpoints
  async getMlStatus(): Promise<any> {
    const response = await this.api.get('/ml/status');
    return response.data;
  }

  async getMlMetrics(): Promise<any> {
    const response = await this.api.get('/ml/metrics');
    return response.data;
  }

  async getMlHistory(): Promise<any[]> {
    const response = await this.api.get<any[]>('/ml/history');
    return response.data;
  }

  async reloadMl(version?: string): Promise<any> {
    const response = await this.api.post('/ml/reload', { version });
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;

export function getAxiosErrorMessage(error: unknown): string {
  const err = error as AxiosError<{ message?: string | string[] }>;
  const dataMessage = err.response?.data?.message;
  if (Array.isArray(dataMessage)) return dataMessage.join(', ');
  if (typeof dataMessage === 'string') return dataMessage;
  if (err.message) return err.message;
  return 'Unexpected error';
}
