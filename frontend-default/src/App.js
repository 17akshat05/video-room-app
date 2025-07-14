import React, { useState } from 'react';
import Room from './Room';
import { Box, Button, Container, TextField, Typography, Paper } from '@mui/material';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

function App() {
  const [roomId, setRoomId] = useState('');
  const [joinedRoom, setJoinedRoom] = useState(null);

  const handleJoin = () => {
    if (roomId.trim()) setJoinedRoom(roomId.trim());
  };

  const handleCreate = () => {
    const newRoom = Math.random().toString(36).substr(2, 8);
    setRoomId(newRoom);
    setJoinedRoom(newRoom);
  };

  if (joinedRoom) {
    return <Room roomId={joinedRoom} />;
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 10 }}>
      <Paper elevation={6} sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
        <Typography variant="h3" color="primary" gutterBottom fontWeight={700}>
          Watch Together
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Create or join a room to start a video call and watch shows together!
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mt: 3, mb: 2, justifyContent: 'center' }}>
          <TextField
            label="Room ID"
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
            variant="outlined"
            size="small"
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            color="primary"
            startIcon={<MeetingRoomIcon />}
            onClick={handleJoin}
            sx={{ minWidth: 120 }}
          >
            Join Room
          </Button>
        </Box>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<AddCircleOutlineIcon />}
          onClick={handleCreate}
          sx={{ mt: 2 }}
        >
          Create New Room
        </Button>
      </Paper>
    </Container>
  );
}

export default App;
