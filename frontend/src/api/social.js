import client from './client.js';

export const socialApi = {
  getConnections: () => client.get('/social/connections').then(r => r.data),
  connectInstagram: async () => {
    const { url } = await client.get('/social/instagram/auth').then(r => r.data);
    window.location.href = url;
  },
  connectLinkedin: async () => {
    const { url } = await client.get('/social/linkedin/auth').then(r => r.data);
    window.location.href = url;
  },
  disconnectInstagram: () => client.delete('/social/instagram').then(r => r.data),
  disconnectLinkedin: () => client.delete('/social/linkedin').then(r => r.data),
};
