const API_URL = "http://127.0.0.1:8000";

export async function getTaskStatus(taskId: string) {
  const response = await fetch(`${API_URL}/tasks/${taskId}`);
  return response.json();
}
