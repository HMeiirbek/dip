import axios, { AxiosInstance } from 'axios';
import {
  User,
  AuthResponse,
  RegisterResponse,
  Call,
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

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
    const response = await this.api.put<Call>(`/calls/${id}/end`, {});
    return response.data;
  }
}

const apiService = new ApiService();
export default apiService;
