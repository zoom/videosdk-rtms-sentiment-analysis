# Video SDK Web - RTMS - Sentiment Analysis

Use of this sample app is subject to our [Terms of Use](https://explore.zoom.us/en/video-sdk-terms/).

The [Zoom Video SDK for Web](https://developers.zoom.us/docs/video-sdk/web/) enables you to build custom video experiences on a webpage with Zoom's core technology. This demo showcases how to use [Video SDK RTMS Streams](https://developers.zoom.us/docs/rtms/video-sdk/) to receive real-time transcripts from Zoom on your backend server. The server then runs a Tensorflow model for Sentiment Analysis on the transcript and outputs the result to the server console.

## Installation

To get started, clone the repo:

`git clone https://github.com/zoom/zoom-rtms-sentiment-sample.git`

This app requires Node Version 22.22.0 or below. You can install it to your project environment using this command:

`nvm install 22`

## Setup

1. Install the dependencies:

   `bun install # or npm install`

2. Create a `.env` file in the root directory of the project, you can do this by copying the `.env.example` file (`cp .env.example .env`) and replacing the values with your own. The `.env` file should look like this, with your own Zoom Video SDK Credentials:

   ```
   VITE_SDK_KEY=abc123XXXXXXXXXX
   VITE_SDK_SECRET=abc123XXXXXXXXXX
   ZOOM_SECRET_TOKEN=abc123XXXXXXXXXX
   PORT=3000
   WORD_THRESHOLD=100
   ```

3. Run the app:

   `npm run dev` or `bun dev`



4. Launch the Auth Server by clicking below:

| Render |
|:-:|
| [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/zoom/zoom-rtms-sentiment-sample)

## Usage

1. Navigate to http://localhost:5173

2. Click "Join" to join the session

3. As you speak, the server will receive RTMS Webhooks containing the transcripts of your speech. The server will then perform a sentiment detection on the text and output a result to the server console

For the full list of features and event listeners, as well as additional guides, see our [Video SDK docs](https://developers.zoom.us/docs/video-sdk/web/).

## Need help?

If you're looking for help, try [Developer Support](https://devsupport.zoom.us) or our [Developer Forum](https://devforum.zoom.us). Priority support is also available with [Premier Developer Support](https://explore.zoom.us/docs/en-us/developer-support-plans.html) plans.

## Disclaimer

Do not expose your credentials to the client, when using the Video SDK in production please make sure to use a backend service to sign the tokens. Don't store credentials in plain text, as this is a sample app we're using an `.env` for sake of simplicity.
