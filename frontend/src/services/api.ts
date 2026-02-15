import axios, { AxiosInstance } from 'axios';
import {
  User,
  AuthResponse,
  RegisterResponse,
  Call,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

class ApiService {
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
    });

    // Load token from localStorage
    this.token = localStorage.getItem('accessToken');
    this.setAuthHeader();
  }

  private setAuthHeader() {
    if (this.token) {
      this.api.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    } else {
      delete this.api.defaults.headers.common['Authorization'];
    }
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

    this.token = response.data.accessToken;
    localStorage.setItem('accessToken', this.token);
    this.setAuthHeader();

    return response.data;
  }

  async getMe(): Promise<User> {
    const response = await this.api.get<User>('/auth/me');
    return response.data;
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem('accessToken');
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
}

const apiService = new ApiService();
export default apiService;
