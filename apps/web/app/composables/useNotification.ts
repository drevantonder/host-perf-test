export const useNotification = () => {
  const toast = useToast()

  return {
    success: (message: string) => {
      toast.add({
        title: 'Success',
        description: message,
        color: 'success',
        icon: 'i-heroicons-check-circle'
      })
    },
    
    error: (message: string) => {
      toast.add({
        title: 'Error',
        description: message,
        color: 'error',
        icon: 'i-heroicons-x-circle'
      })
    },
    
    warning: (message: string) => {
      toast.add({
        title: 'Warning',
        description: message,
        color: 'warning',
        icon: 'i-heroicons-exclamation-triangle'
      })
    },
    
    info: (message: string) => {
      toast.add({
        title: 'Info',
        description: message,
        color: 'info',
        icon: 'i-heroicons-information-circle'
      })
    }
  }
}