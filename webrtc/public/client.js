const socket = io();

const startCallButton = document.getElementById('startCall');
const endCallButton = document.getElementById('endCall');
const localAudio = document.getElementById('localAudio');
const remoteAudio = document.getElementById('remoteAudio');

let localStream;
let peerConnection;

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

startCallButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Prevent local audio playback
  localAudio.srcObject = localStream;
  localAudio.muted = true;  // Mute local audio to avoid hearing your own voice

  peerConnection = new RTCPeerConnection(configuration);

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('candidate', event.candidate);
    }
  };

  peerConnection.ontrack = event => {
    remoteAudio.srcObject = event.streams[0];
  };

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  socket.emit('offer', offer);
};

endCallButton.onclick = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    localAudio.srcObject = null;
    remoteAudio.srcObject = null;

    // Notify the other peer that the call has ended
    socket.emit('endCall');
  }
};

socket.on('offer', async (offer) => {
  if (!peerConnection) {
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('candidate', event.candidate);
      }
    };

    peerConnection.ontrack = event => {
      remoteAudio.srcObject = event.streams[0];
    };

    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', answer);
  }
});

socket.on('answer', async (answer) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
});

socket.on('candidate', async (candidate) => {
  if (peerConnection) {
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Error adding received ice candidate', e);
    }
  }
});

// Listen for end call signal from the other peer
socket.on('endCall', () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
    localAudio.srcObject = null;
    remoteAudio.srcObject = null;
  }
});
