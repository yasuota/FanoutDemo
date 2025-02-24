/// <reference types="@fastly/js-compute" />
import { getServer } from '../static-publisher/statics.js';
import { createFanoutHandoff } from "fastly:fanout";
const staticContentServer = getServer();
addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));
async function handleRequest(event) {
  const req = event.request;
  const url = new URL(req.url);
  // POST Body
  const reqBody = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();
  // Server-Sent Events path 
  if (url.pathname === '/stream/sse') {
    if (req.headers.has('Grip-Sig')) {
      // "test" is the channel name
      return handle_fanout(req, "test"); 
    } else {
      // "self" here means this Fastly service itself. For reference -> https://developer.fastly.com/learning/concepts/real-time-messaging/fanout/#using-fastly-as-a-fanout-backend
      return createFanoutHandoff(req, 'self');
    }
  } else if (url.pathname === '/service/$SERVICEID/publish/') { // Please place your own Service ID and Please keep in mind that you need trailing slash. (https://developer.fastly.com/learning/concepts/real-time-messaging/fanout/#publishing)
    return fetch(req, {
      backend: 'api', // Fastly API Endpoint (api.fasty.com)
      method: "POST",
      body: JSON.stringify({
        "items": [{
          "channel": "test", // The same value for "Grip-Channel"
          "formats": {
            "http-stream": {
              "content": `event: message\ndata: {\"text\": \"${reqBody}\"}\n\n` // JSON Data model for reference ->  https://developer.fastly.com/learning/concepts/real-time-messaging/fanout/#publishing  
            }
          }
        }]
      }),
      headers: {
        "Fastly-Key": "$APIKEY" // WE WOULD RECOMMEND USING SECRET STORE FOR THE TOKEN STORAGE
      }
    });
  }
  // Handle Server-Sent Events
  function handle_fanout(request, data) {
    const response = new Response("", {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Grip-Hold': 'stream',
        'Grip-Channel': 'test'
      }
    });
    return response;
  }
  // Serve index.html
  if (url.pathname === '/') {
    const response = await staticContentServer.serveRequest(event.request);
    if (response != null) {
      return response;
    }
  }
  // Do custom things here!
  // Handle API requests, serve non-static responses, etc.
  return new Response('Not found', { status: 404 });
}
