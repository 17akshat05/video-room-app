import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import SimplePeer from 'simple-peer';
import ReactPlayer from 'react-player';

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
    <div>
      <h2>Room: {roomId}</h2>
      <div style={{ display: 'flex', gap: 20 }}>
        <div>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: 200, border: '1px solid #ccc' }} />
          {peers.map(({ peerID, peer }) => (
            <Video key={peerID} peer={peer} />
          ))}
        </div>
        <div>
          <input
            value={videoUrl}
            onChange={e => setVideoUrl(e.target.value)}
            placeholder="Paste YouTube URL"
            style={{ width: 300 }}
          />
          <ReactPlayer
            ref={playerRef}
            url={videoUrl}
            playing={playing}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onProgress={({ playedSeconds }) => setPlayed(playedSeconds)}
            controls
            width={400}
          />
        </div>
      </div>
    </div>
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
  return <video ref={ref} autoPlay playsInline style={{ width: 200, border: '1px solid #ccc' }} />;
}

export default Room; 