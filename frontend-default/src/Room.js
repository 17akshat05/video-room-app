import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';
import ReactPlayer from 'react-player';
import {
  Box, Button, Container, Grid, Paper, TextField, Typography, IconButton, Stack, AppBar, Toolbar, Tooltip
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import LinkIcon from '@mui/icons-material/Link';

const SERVER_URL = 'http://localhost:3000'; // Change to deployed backend URL when deploying

function Room({ roomId }) {
  const [peers, setPeers] = useState([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(0);
  const [userId] = useState(() => Math.random().toString(36).substr(2, 8));
  const socketRef = useRef();
  const peersRef = useRef([]);
  const playerRef = useRef();
  const localVideoRef = useRef();

  useEffect(() => {
    socketRef.current = io(SERVER_URL);
    socketRef.current.emit('join-room', roomId, userId);

    // WebRTC signaling
    socketRef.current.on('all-users', users => {
      const peers = users.map(userID => {
        const peer = createPeer(userID, socketRef.current.id, roomId);
        peersRef.current.push({ peerID: userID, peer });
        return { peerID: userID, peer };
      });
      setPeers(peers);
    });

    socketRef.current.on('user-joined', userID => {
      const peer = addPeer(userID, socketRef.current.id, roomId);
      peersRef.current.push({ peerID: userID, peer });
      setPeers(users => [...users, { peerID: userID, peer }]);
    });

    socketRef.current.on('signal', ({ from, signal }) => {
      const item = peersRef.current.find(p => p.peerID === from);
      if (item) {
        item.peer.signal(signal);
      }
    });

    socketRef.current.on('user-left', id => {
      setPeers(users => users.filter(u => u.peerID !== id));
      peersRef.current = peersRef.current.filter(p => p.peerID !== id);
    });

    // Video sync
    socketRef.current.on('video-sync', ({ action, time }) => {
      if (action === 'play') setPlaying(true);
      if (action === 'pause') setPlaying(false);
      if (action === 'seek') {
        setPlayed(time);
        if (playerRef.current) playerRef.current.seekTo(time, 'seconds');
      }
    });

    // Cleanup
    return () => {
      socketRef.current.disconnect();
    };
    // eslint-disable-next-line
  }, [roomId]);

  // WebRTC helpers
  function createPeer(userToSignal, callerID, roomId) {
    const peer = new SimplePeer({ initiator: true, trickle: false, stream: localVideoRef.current?.srcObject });
    peer.on('signal', signal => {
      socketRef.current.emit('signal', { roomId, signal, to: userToSignal });
    });
    return peer;
  }

  function addPeer(incomingID, callerID, roomId) {
    const peer = new SimplePeer({ initiator: false, trickle: false, stream: localVideoRef.current?.srcObject });
    peer.on('signal', signal => {
      socketRef.current.emit('signal', { roomId, signal, to: incomingID });
    });
    return peer;
  }

  // Video controls
  const handlePlay = () => {
    setPlaying(true);
    socketRef.current.emit('video-sync', { roomId, action: 'play' });
  };
  const handlePause = () => {
    setPlaying(false);
    socketRef.current.emit('video-sync', { roomId, action: 'pause' });
  };
  const handleSeek = e => {
    const time = e.playedSeconds;
    setPlayed(time);
    socketRef.current.emit('video-sync', { roomId, action: 'seek', time });
  };

  // Get user media
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      // Attach stream to all peers
      peersRef.current.forEach(({ peer }) => {
        peer.addStream(stream);
      });
    });
  }, []);

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <AppBar position="static" color="primary" sx={{ mb: 3, borderRadius: 2 }}>
        <Toolbar>
          <Typography variant="h5" sx={{ flexGrow: 1 }}>
            Room: {roomId}
          </Typography>
          <Tooltip title="Copy Room Link">
            <IconButton color="inherit" onClick={() => navigator.clipboard.writeText(window.location.href)}>
              <LinkIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={4} sx={{ p: 2, bgcolor: 'background.paper', mb: 2 }}>
            <Typography variant="h6" color="secondary" gutterBottom>
              Video Call Screens
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', border: '2px solid #1976d2' }}>
                  <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', background: '#222' }} />
                  <Typography variant="caption" sx={{ position: 'absolute', bottom: 8, left: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.5)', px: 1, borderRadius: 1 }}>
                    You
                  </Typography>
                </Box>
              </Grid>
              {peers.map(({ peerID, peer }) => (
                <Grid item xs={6} key={peerID}>
                  <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', border: '2px solid #ff4081' }}>
                    <Video peer={peer} />
                    <Typography variant="caption" sx={{ position: 'absolute', bottom: 8, left: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.5)', px: 1, borderRadius: 1 }}>
                      {peerID}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={4} sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Typography variant="h6" color="secondary" gutterBottom>
              Shared Player
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <TextField
                label="YouTube URL"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                variant="outlined"
                size="small"
                sx={{ flex: 1 }}
              />
              <IconButton color="primary" onClick={handlePlay} disabled={playing}>
                <PlayArrowIcon />
              </IconButton>
              <IconButton color="primary" onClick={handlePause} disabled={!playing}>
                <PauseIcon />
              </IconButton>
              <IconButton color="primary">
                <VolumeUpIcon />
              </IconButton>
              <IconButton color="primary" onClick={() => playerRef.current && playerRef.current.wrapper.requestFullscreen && playerRef.current.wrapper.requestFullscreen()}>
                <FullscreenIcon />
              </IconButton>
            </Stack>
            <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '2px solid #1976d2', bgcolor: '#000' }}>
              <ReactPlayer
                ref={playerRef}
                url={videoUrl}
                playing={playing}
                onPlay={handlePlay}
                onPause={handlePause}
                onSeek={handleSeek}
                onProgress={({ playedSeconds }) => setPlayed(playedSeconds)}
                controls
                width="100%"
                height="320px"
                style={{ background: '#000' }}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

function Video({ peer }) {
  const ref = useRef();
  useEffect(() => {
    peer.on('stream', stream => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    });
  }, [peer]);
  return <video ref={ref} autoPlay playsInline style={{ width: '100%', background: '#222' }} />;
}

export default Room; 