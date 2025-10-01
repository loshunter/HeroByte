export class NetClient {
  private ws?: WebSocket;
  private rtcSignalHandler?: (from: string, signal: any) => void;

  connect(url: string, uid: string, onSnap: (snap: any) => void) {
    // pass the uid as a query param so the server can identify the player
    this.ws = new WebSocket(`${url}?uid=${uid}`);

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        // Check if it's an RTC signal message
        if (msg.t === "rtc-signal") {
          if (this.rtcSignalHandler) {
            this.rtcSignalHandler(msg.from, msg.signal);
          }
        } else {
          // Otherwise it's a room snapshot
          onSnap(msg);
        }
      } catch (e) {
        console.error("Bad message", e);
      }
    };

    this.ws.onopen = () => {
      console.log("Connected as", uid);
    };

    this.ws.onclose = () => {
      console.log("Disconnected");
    };
  }

  onRtcSignal(handler: (from: string, signal: any) => void) {
    this.rtcSignalHandler = handler;
  }

  send(msg: any) {
    this.ws?.send(JSON.stringify(msg));
  }
}
