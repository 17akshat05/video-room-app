import React, { useState } from 'react';
import './App.css';
import Room from './Room';

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
    <div className="App">
      <h1>Watch Together</h1>
      <input
        value={roomId}
        onChange={e => setRoomId(e.target.value)}
        placeholder="Enter Room ID"
      />
      <button onClick={handleJoin}>Join Room</button>
      <button onClick={handleCreate}>Create Room</button>
    </div>
  );
}

export default App;
