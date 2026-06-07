import toast from 'react-hot-toast';

type ApiError = {
  response?: { data?: { message?: string } };
  message?: string;
};

/** Extract a user-facing message from an Axios/API error. */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as ApiError;
  return err?.response?.data?.message || err?.message || fallback;
}

/** Show a toast from an API error. */
export function toastApiError(error: unknown, fallback: string): void {
  toast.error(getApiErrorMessage(error, fallback));
}
