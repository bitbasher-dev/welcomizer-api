import fetch from "node-fetch";
import { CONFIG } from "./config";

async function run() {
  const response = await fetch(`https://fcm.googleapis.com/fcm/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `key=${CONFIG.FIREBASE_CLOUD_MESSAGING_TOKEN}`,
    },
    body: JSON.stringify({
      to: "d1Zr08xGZkKhkCr5OteHwM:APA91bGjw3pS5h63SemNGBjao1mvacajVt3b69VwfQWy6vNnvNR5pAgWmMJ6MuMB8WO1_szSTQghKQ43OuDhy7gKfHnR-2sVB74K8OZDJSTYC8bQ2i0AJWx5tlv8MsbQRCdVQAcMn9H-",
      notification: {
        title: "New opt-in",
        body: "You got a new opt-in through BerserkerMail with name Pedro Palhari",
      },

      data: {
        videoId: "palhari",
      },
    }),
  });

  const responseJSON = await response.json();

  console.log({ responseJSON });
}

run();
