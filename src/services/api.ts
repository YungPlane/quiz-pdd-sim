interface QuizResult {
  fio: string;
  school: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  answers: Array<{
    questionId: number;
    selectedAnswer: number;
    isCorrect: boolean;
  }>;
  quizType?: string;
}

interface ResultRecord extends Omit<QuizResult, 'passed'> {
  id: number;
  passed: number;
  created_at: string;
  quiz_type: string;
}

interface ResultsResponse {
  results: ResultRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface Statistics {
  totalAttempts: number;
  avgPercentage: number;
  passedCount: number;
  failedCount: number;
  highestScore: number;
  lowestScore: number;
}

interface AppSettings {
  authRequired: boolean;
}

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('adminToken');
  }

  private getHeaders(): HeadersInit {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  // User result submission
  async submitResult(result: QuizResult): Promise<{ id: number }> {
    const response = await fetch(`/api/results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit result');
    }

    return response.json();
  }

  // Admin login
  async adminLogin(username: string, password: string): Promise<{ token: string; username: string }> {
    const response = await fetch(`/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Invalid credentials');
    }

    const data = await response.json();
    localStorage.setItem('adminToken', data.token);
    localStorage.setItem('adminUsername', data.username);
    return data;
  }

  // Verify admin token
  async verifyAdmin(): Promise<{ valid: boolean; username: string }> {
    const response = await fetch(`/api/admin/verify`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Invalid or expired token');
    }

    return response.json();
  }

  // Get results
  async getResults(params?: {
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: 'ASC' | 'DESC';
    search?: string;
    quizType?: string;
  }): Promise<ResultsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.sortBy) queryParams.append('sortBy', params.sortBy);
    if (params?.order) queryParams.append('order', params.order);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.quizType) queryParams.append('quizType', params.quizType);

    const response = await fetch(`/api/results?${queryParams}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch results');
    }

    return response.json();
  }

  // Get statistics
  async getStatistics(quizType?: string): Promise<Statistics> {
    const queryParams = new URLSearchParams();
    if (quizType) queryParams.append('quizType', quizType);

    const response = await fetch(`/api/statistics?${queryParams}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch statistics');
    }

    return response.json();
  }

  // Export results to Excel
  async exportResults(quizType?: string): Promise<void> {
    const queryParams = new URLSearchParams();
    if (quizType) queryParams.append('quizType', quizType);

    const response = await fetch(`/api/results/export?${queryParams}`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to export results');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `results${quizType ? `_${quizType}` : ''}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await fetch(`/api/admin/password`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to change password');
    }

    return response.json();
  }

  // Delete a result
  async deleteResult(id: number): Promise<void> {
    const response = await fetch(`/api/results/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete result');
    }
  }

  // Get app settings
  async getSettings(): Promise<AppSettings> {
    const response = await fetch(`/api/settings`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch settings');
    }

    return response.json();
  }

  // Update app settings
  async updateSettings(settings: Partial<AppSettings>): Promise<{ message: string }> {
    const response = await fetch(`/api/settings`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update settings');
    }

    return response.json();
  }

  // Logout
  logout(): void {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUsername');
  }
}

export const api = new ApiService();