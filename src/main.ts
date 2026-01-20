import ZoomVideo, { event_peer_video_state_change, RealTimeMediaStreamsStatus, VideoPlayer, VideoQuality, RealTimeMediaStreamsClient, VideoClient } from "@zoom/videosdk";
import { generateSignature } from "./utils";
import "./style.css";
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";

const loader: string = '<div id="rtms-start-loader" class="flex justify-center"><div class="h-6 w-6 mr-[5px] animate-spin rounded-full border-4 border-solid border-white border-t-transparent"></div>';

// !!You should sign your JWT with a backend service in a production use-case!!
const sdkKey = import.meta.env.VITE_SDK_KEY as string;
const sdkSecret = import.meta.env.VITE_SDK_SECRET as string;

const videoContainer = document.querySelector('video-player-container') as HTMLElement;
const sessionName: string = "TestOne";
const role: number = 1;
const username: string = `User-${String(new Date().getTime()).slice(6)}`;

const client = ZoomVideo.createClient() as typeof VideoClient;
await client.init("en-US", "Global", { patchJsMedia: false, });

const RTMSClient = client.getRealTimeMediaStreamsClient() as typeof RealTimeMediaStreamsClient;
let RTMSStatus: RealTimeMediaStreamsStatus | null = null;

const startCall = async () => {
    const token = generateSignature(sessionName, role, sdkKey, sdkSecret);
    client.on("peer-video-state-change", renderVideo);

    await client.join(sessionName, token, username);
    const mediaStream = client.getMediaStream();
    if (!mediaStream.isSupportVideoProcessor()) alert("Your browser does not support video processor");
    await mediaStream.startAudio({mute: false});
    await mediaStream.startVideo();

    // render the video of the current user
    await renderVideo({ action: 'Start', userId: client.getCurrentUserInfo().userId });
};

const renderVideo: typeof event_peer_video_state_change = async (event) => {
    const mediaStream = client.getMediaStream();
    if (event.action === 'Stop') {
        const element = await mediaStream.detachVideo(event.userId);
        if (Array.isArray(element))
            element.forEach((el) => el.remove())
        else if (element) element.remove();
    } else {
        const userVideo = await mediaStream.attachVideo(event.userId, VideoQuality.Video_720P);
        videoContainer.appendChild(userVideo as VideoPlayer);
    }
};

const leaveCall = async () => {
    const mediaStream = client.getMediaStream();
    for (const user of client.getAllUser()) {
        const element = await mediaStream.detachVideo(user.userId);
        if (Array.isArray(element))
            element.forEach((el) => el.remove())
        else if (element) element.remove();
    }
    client.off("peer-video-state-change", renderVideo);
    await client.leave();
}

const displayToast = (message: string) => {
    Toastify({
          text: message,
          duration: 4000,
          gravity: "bottom", 
          position: "left", 
        }).showToast();
};

const updateControlsUI = async() => {
    RTMSStatus = RTMSClient.getRealTimeMediaStreamsStatus();

    console.log("RTMS Status:", RTMSStatus);

    switch(RTMSStatus) {
        case RealTimeMediaStreamsStatus.Start:
            displayToast("RTMS Session Started");
            startRTMSBtn.style.display = "none";
            stopRTMSBtn.style.display = "block";
            pauseRTMSBtn.style.display = "block";
            resumeRTMSBtn.style.display = "none";
            break;
        case RealTimeMediaStreamsStatus.StartFailed:
            displayToast("RTMS Session Failed to Start");
            startRTMSBtn.innerHTML = "Start RTMS";
            startRTMSBtn.style.display = "block";
            stopRTMSBtn.style.display = "none";
            pauseRTMSBtn.style.display = "none";
            resumeRTMSBtn.style.display = "none";
            break;
        case RealTimeMediaStreamsStatus.NoSubscription:
            displayToast("No RTMS Subscription on Account");
            startRTMSBtn.innerHTML = "Start RTMS";
            startRTMSBtn.style.display = "block";
            stopRTMSBtn.style.display = "none";
            pauseRTMSBtn.style.display = "none";
            resumeRTMSBtn.style.display = "none";
            break;
        case RealTimeMediaStreamsStatus.None:
            displayToast("RTMS is not initialized");
            startRTMSBtn.innerHTML = "Start RTMS";
            startRTMSBtn.style.display = "block";
            stopRTMSBtn.style.display = "none";
            pauseRTMSBtn.style.display = "none";
            resumeRTMSBtn.style.display = "none";
            break;
        case RealTimeMediaStreamsStatus.Pause:
            displayToast("RTMS Paused");
            startRTMSBtn.style.display = "none";
            stopRTMSBtn.style.display = "block";
            pauseRTMSBtn.style.display = "none";
            resumeRTMSBtn.style.display = "block";
            break;
        case RealTimeMediaStreamsStatus.Stop:
            displayToast("RTMS Stopped");
            startRTMSBtn.innerHTML = "Start RTMS";
            startRTMSBtn.style.display = "block";
            stopRTMSBtn.style.display = "none";
            pauseRTMSBtn.style.display = "none";
            resumeRTMSBtn.style.display = "none";
            break;
    }
}

const startRTMSSession = async () => {
    if (!RTMSClient.isSupportRealTimeMediaStreams()) {      
        displayToast("RTMS not supported. Contact Support to enable.");
    } else if (!RTMSClient.canStartRealTimeMediaStreams()) {
        displayToast("RTMS cannot be started by this user");
    }
    startRTMSBtn.innerHTML = loader;
    startRTMSBtn.disabled = true;
    await RTMSClient.startRealTimeMediaStreams();
    updateControlsUI();
};
const stopRTMSSession = async () => {
    await RTMSClient.stopRealTimeMediaStreams();
    updateControlsUI();
};
const resumeRTMSSession = async () => {
    await RTMSClient.resumeRealTimeMediaStreams();
    updateControlsUI();
};
const pauseRTMSSession = async () => {
    await RTMSClient.pauseRealTimeMediaStreams();
    updateControlsUI();
};

// UI Logic
const startBtn = document.querySelector("#start-btn") as HTMLButtonElement;
const stopBtn = document.querySelector("#stop-btn") as HTMLButtonElement;

const rtmsform = document.querySelector("#rtms-form") as HTMLDivElement;

const startRTMSBtn = document.getElementById('start-rtms-btn') as HTMLButtonElement; 
const stopRTMSBtn = document.getElementById('stop-rtms-btn') as HTMLButtonElement; 
const pauseRTMSBtn = document.getElementById('pause-rtms-btn') as HTMLButtonElement; 
const resumeRTMSBtn = document.getElementById('resume-rtms-btn') as HTMLButtonElement; 

startBtn.addEventListener("click", async () => {
    if (!sdkKey || !sdkSecret) {
        alert("Please enter SDK Key and SDK Secret in the .env file");
        return;
    }
    startBtn.innerHTML = loader;
    startBtn.disabled = true;
    await startCall();
    startBtn.innerHTML = "Connected";
    startBtn.style.display = "none";
    rtmsform.style.display = "flex";

});

stopBtn.addEventListener("click", async () => {
    await leaveCall();
    startBtn.style.display = "block";
    startBtn.innerHTML = "Join";
    startBtn.disabled = false;
    rtmsform.style.display = "none";
});

startRTMSBtn.addEventListener("click", startRTMSSession);
stopRTMSBtn.addEventListener("click", stopRTMSSession);
pauseRTMSBtn.addEventListener("click", pauseRTMSSession);
resumeRTMSBtn.addEventListener("click", resumeRTMSSession);
