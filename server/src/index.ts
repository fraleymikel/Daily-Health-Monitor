import express from 'express';
import cors from 'cors';
import path from 'path';
import checkinRoutes from './routes/checkin';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/checkin', checkinRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

// Serve static files in production
const clientBuild = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientBuild));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientBuild, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Daily Health Monitor server running on port ${PORT}`);
});
