import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        mode: 'dark',

        background: {
            default: '#0B0F14',
            paper: '#111827'
        },

        primary: { main: '#7AA2F7' },
        info:    { main: '#89B4FA' },
        success: { main: '#7BD88F' },
        warning: { main: '#E6C07B' },
        error:   { main: '#F28B82' },

        text: {
            primary: '#E6EAF2',
            secondary: '#A6B0C3'
        },

        divider: '#223044'
    },

    shape: { borderRadius: 12 },

    typography: {
        fontFamily: 'Manrope, system-ui, -apple-system, sans-serif',
        h5: { fontWeight: 700 },
        subtitle2: { fontWeight: 600 }
    },

    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid rgba(255,255,255,0.06)'
                }
            }
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid rgba(255,255,255,0.06)'
                }
            }
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderRadius: 12
                }
            }
        }
    }
});

export default theme;