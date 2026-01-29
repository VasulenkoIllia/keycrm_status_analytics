import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0e1116',
      paper: '#161b22'
    },
    primary: { main: '#4cc9f0' },
    success: { main: '#41d69f' },
    warning: { main: '#f7b500' },
    error: { main: '#f74c52' },
    info: { main: '#7c8df2' },
    text: {
      primary: '#e8edf5',
      secondary: '#9ba4b5'
    }
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: 'Manrope, system-ui, -apple-system, sans-serif',
    h5: { fontWeight: 700 },
    subtitle2: { fontWeight: 600 }
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', border: '1px solid #202632' }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: { backgroundImage: 'none', border: '1px solid #202632' }
      }
    }
  }
});

export default theme;
