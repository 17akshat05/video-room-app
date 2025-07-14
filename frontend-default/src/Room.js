import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';
import ReactPlayer from 'react-player';
import {
  Box, Button, Container, Grid, Paper, TextField, Typography, IconButton, Stack, AppBar, Toolbar, Tooltip, Avatar, InputAdornment, List, ListItem, ListItemAvatar, ListItemText
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import LinkIcon from '@mui/icons-material/Link';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';

const SERVER_URL = process.env.REACT_APP_BACKEND_URL || 'https://video-room-app.onrender.com';
const EMOJIS = ['😀','😂','😍','👍','👏','🎉','😮','😢','😡'];

function Room({ roomId }) {
  const [peers, setPeers] = useState([]); // [{ peerID, peer, userId }]
  const [videoUrl, setVideoUrl] = useState('');
  const [playing, setPlaying] = useState(false);
  const [played, setPlayed] = useState(0);
  const [userId] = useState(() => Math.random().toString(36).substr(2, 8));
  const [chat, setChat] = useState([]);
  const [message, setMessage] = useState('');
  const [emojiQueue, setEmojiQueue] = useState([]);
  const [cameraOn, setCameraOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [users, setUsers] = useState([]); // [{ socketId, userId }]
  const socketRef = useRef();
  const peersRef = useRef([]);
  const playerRef = useRef();
  const localVideoRef = useRef();
  const localStream = useRef();

  // Connect and handle signaling
  useEffect(() => {
    socketRef.current = io(SERVER_URL);
    socketRef.current.emit('join-room', roomId, userId);

    socketRef.current.on('room-state', ({ users: userList, video }) => {
      setUsers(userList);
      setVideoUrl(video.url);
      setPlaying(video.playing);
      setPlayed(video.time);
      // Create peers for all existing users
      const newPeers = [];
      userList.forEach(({ socketId, userId: uid }) => {
        if (socketId !== socketRef.current.id) {
          const peer = createPeer(socketId, true); // initiator
          peersRef.current.push({ peerID: socketId, peer, userId: uid });
          newPeers.push({ peerID: socketId, peer, userId: uid });
        }
      });
      setPeers(newPeers);
    });

    socketRef.current.on('user-joined', ({ socketId, userId: uid }) => {
      setUsers(users => [...users, { socketId, userId: uid }]);
      // Existing users create a peer connection to the new user (not initiator)
      if (socketId !== socketRef.current.id) {
        const peer = createPeer(socketId, false); // not initiator
        peersRef.current.push({ peerID: socketId, peer, userId: uid });
        setPeers(users => [...users, { peerID: socketId, peer, userId: uid }]);
      }
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
      setUsers(users => users.filter(u => u.socketId !== id));
    });

    // Video sync
    socketRef.current.on('video-sync', ({ action, url, time, playing }) => {
      if (action === 'url' && url) setVideoUrl(url);
      if (action === 'play') setPlaying(true);
      if (action === 'pause') setPlaying(false);
      if (action === 'seek' && typeof time === 'number') {
        setPlayed(time);
        if (playerRef.current) playerRef.current.seekTo(time, 'seconds');
      }
    });

    // Chat
    socketRef.current.on('chat-message', ({ userId, message }) => {
      setChat(chat => [...chat, { userId, message }]);
    });

    // Emoji
    socketRef.current.on('emoji', ({ userId, emoji }) => {
      setEmojiQueue(q => [...q, { userId, emoji, ts: Date.now() }]);
      setTimeout(() => setEmojiQueue(q => q.slice(1)), 2000);
    });

    return () => {
      socketRef.current.disconnect();
    };
    // eslint-disable-next-line
  }, [roomId]);

  // WebRTC helpers
  function createPeer(peerID, initiator) {
    const peer = new SimplePeer({ initiator, trickle: false, stream: localStream.current });
    peer.on('signal', signal => {
      socketRef.current.emit('signal', { roomId, signal, to: peerID });
    });
    return peer;
  }

  // Video controls
  const handlePlay = () => {
    setPlaying(true);
    socketRef.current.emit('video-sync', { roomId, action: 'play', playing: true });
  };
  const handlePause = () => {
    setPlaying(false);
    socketRef.current.emit('video-sync', { roomId, action: 'pause', playing: false });
  };
  const handleSeek = e => {
    const time = e.playedSeconds;
    setPlayed(time);
    socketRef.current.emit('video-sync', { roomId, action: 'seek', time });
  };
  const handleUrlChange = e => {
    setVideoUrl(e.target.value);
    socketRef.current.emit('video-sync', { roomId, action: 'url', url: e.target.value });
  };

  // Get user media
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: cameraOn, audio: micOn }).then(stream => {
      localStream.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      // Attach stream to all peers
      peersRef.current.forEach(({ peer }) => {
        peer.addStream(stream);
      });
    });
    // eslint-disable-next-line
  }, [cameraOn, micOn]);

  // Chat
  const sendMessage = () => {
    if (message.trim()) {
      socketRef.current.emit('chat-message', { roomId, userId, message });
      setMessage('');
    }
  };

  // Emoji
  const sendEmoji = emoji => {
    socketRef.current.emit('emoji', { roomId, userId, emoji });
  };

  // AV controls
  const toggleCamera = () => setCameraOn(on => !on);
  const toggleMic = () => setMicOn(on => !on);

  return (
    <Container maxWidth="xl" sx={{ mt: 2 }}>
      <AppBar position="static" color="primary" sx={{ mb: 2, borderRadius: 2 }}>
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
      <Grid container spacing={2}>
        {/* Video Grid */}
        <Grid item xs={12} md={8}>
          <Paper elevation={4} sx={{ p: 2, bgcolor: 'background.paper', mb: 2 }}>
            <Typography variant="h6" color="secondary" gutterBottom>
              Video Call
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={4} md={3}>
                <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', border: '2px solid #1976d2' }}>
                  <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', background: '#222' }} />
                  <Typography variant="caption" sx={{ position: 'absolute', bottom: 8, left: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.5)', px: 1, borderRadius: 1 }}>
                    You
                  </Typography>
                  {emojiQueue.map((e, i) => e.userId === userId && <span key={i} style={{ position: 'absolute', top: 8, right: 8, fontSize: 32 }}>{e.emoji}</span>)}
                </Box>
              </Grid>
              {peers.map(({ peerID, peer, userId: uid }) => (
                <Grid item xs={6} sm={4} md={3} key={peerID}>
                  <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', border: '2px solid #ff4081' }}>
                    <Video peer={peer} />
                    <Typography variant="caption" sx={{ position: 'absolute', bottom: 8, left: 8, color: '#fff', bgcolor: 'rgba(0,0,0,0.5)', px: 1, borderRadius: 1 }}>
                      {uid}
                    </Typography>
                    {emojiQueue.map((e, i) => e.userId === uid && <span key={i} style={{ position: 'absolute', top: 8, right: 8, fontSize: 32 }}>{e.emoji}</span>)}
                  </Box>
                </Grid>
              ))}
            </Grid>
            <Stack direction="row" spacing={2} sx={{ mt: 2, justifyContent: 'center' }}>
              <IconButton color={cameraOn ? 'primary' : 'default'} onClick={toggleCamera}>
                {cameraOn ? <VideocamIcon /> : <VideocamOffIcon />}
              </IconButton>
              <IconButton color={micOn ? 'primary' : 'default'} onClick={toggleMic}>
                {micOn ? <MicIcon /> : <MicOffIcon />}
              </IconButton>
              {EMOJIS.map(emoji => (
                <IconButton key={emoji} onClick={() => sendEmoji(emoji)}>
                  <span style={{ fontSize: 24 }}>{emoji}</span>
                </IconButton>
              ))}
            </Stack>
          </Paper>
          {/* Player */}
          <Paper elevation={4} sx={{ p: 2, bgcolor: 'background.paper' }}>
            <Typography variant="h6" color="secondary" gutterBottom>
              Shared Player
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <TextField
                label="YouTube URL"
                value={videoUrl}
                onChange={handleUrlChange}
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
        {/* Sidebar: Chat */}
        <Grid item xs={12} md={4}>
          <Paper elevation={4} sx={{ p: 2, bgcolor: 'background.paper', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" color="secondary" gutterBottom>
              Chat
            </Typography>
            <Box sx={{ flex: 1, overflowY: 'auto', mb: 2, maxHeight: 350 }}>
              <List>
                {chat.map((msg, i) => (
                  <ListItem key={i} alignItems="flex-start">
                    <ListItemAvatar>
                      <Avatar>{msg.userId[0]}</Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={msg.message} secondary={msg.userId} />
                  </ListItem>
                ))}
              </List>
            </Box>
            <Stack direction="row" spacing={1}>
              <TextField
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                size="small"
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={sendMessage} color="primary">
                        <EmojiEmotionsIcon />
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />
            </Stack>
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