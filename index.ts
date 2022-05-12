import fetch from "node-fetch";
import fastify from "fastify";
import fastifyCors from "@fastify/cors";
import { CONFIG } from "./config";
import { PrismaClient } from "@prisma/client";
import { initializeApp } from "firebase/app";
import { customAlphabet } from "nanoid";

import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getStorage, ref, listAll, getDownloadURL } from "firebase/storage";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC2Mb8kPg-9F9zUofSRDORCctg0v5v7gyg",
  authDomain: "welcomizer-dev.firebaseapp.com",
  databaseURL: "https://welcomizer-dev.firebaseio.com",
  projectId: "welcomizer-dev",
  storageBucket: "welcomizer-dev.appspot.com",
  messagingSenderId: "859585679554",
  appId: "1:859585679554:web:7670b8dfe0d66fe9dd2b5b",
  measurementId: "G-NNKJYLC930",
};

// Initialize Firebase
const firebase = initializeApp(firebaseConfig);
const storage = getStorage(firebase);
const db = getFirestore(firebase);

// Create a reference under which you want to list
const listRef = ref(storage, "/");

const hashNanoid = customAlphabet(
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_",
  6
);

const app = fastify();
app.register(fastifyCors);

const prisma = new PrismaClient();

async function getFirebaseFCMTokens() {
  const docRef = doc(db, "users", "9uKM9DzNVaV0IyYyDTDSaZnt3R62");
  const docSnap = await getDoc(docRef);

  return docSnap.data()?.fcmTokens;
}

async function run() {
  const prismaWalMode = await prisma.$queryRaw`
    pragma journal_mode = WAL;
    pragma synchronous = normal;
    pragma temp_store = memory;
    pragma mmap_size = 30000000000;
  `;

  console.log({ prismaWalMode });

  app.get("/ping", async () => {
    return {
      name: "Palhari, 2022",
      now: new Date(),
    };
  });

  app.post<{
    Body: {
      contactFirstName: string;
      contactLastName: string;
      contactEmail: string;
      appName: string;
    };
  }>("/notify", async (req) => {
    const { contactEmail, contactFirstName, contactLastName, appName } =
      req.body;

    const hash = hashNanoid();

    console.log(`Created video #${hash}`);

    const video = await prisma.videoNotification.create({
      data: {
        contactEmail,
        alreadyProcessed: false,
        hash,
      },
    });

    let registration_ids = await getFirebaseFCMTokens();

    const response = await fetch(`https://fcm.googleapis.com/fcm/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${CONFIG.FIREBASE_CLOUD_MESSAGING_TOKEN}`,
      },
      body: JSON.stringify({
        registration_ids,
        notification: {
          title: "New opt-in!",
          body: `${contactFirstName ? `${contactFirstName} ` : ""}${
            contactLastName ? `${contactLastName} ` : `${contactEmail} `
          }just opted in to ${appName}`,
        },

        data: {
          videoId: `${video.id}_`,
        },
      }),
    });

    const responseJSON = await response.json();
    console.log({ responseJSON });

    return "ok";
  });

  app.get<{ Params: { hash: string } }>("/video/:hash", async (req, res) => {
    const { hash } = req.params;

    const video = await prisma.videoNotification.findFirst({
      where: {
        hash,
      },
    });

    if (!video) {
      return res.status(404).send({ msg: `Video not found with hash ${hash}` });
    }

    let url = await getDownloadURL(ref(storage, `/${video.finalVideoName}`));

    res.redirect(302, url);
  });

  async function sendVideoToBMContact(params: {
    email: string;
    welcomizerVideoURL: string;
  }) {
    const { email, welcomizerVideoURL } = params;

    if (
      email !== "pedropalhari@gmail.com" &&
      email !== "nicoleandersonenglish@gmail.com"
    )
      return;

    let response = await fetch(
      `https://api.berserkermail.com/external-api/contact`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${CONFIG.BM_API_KEY}`,
        },
        body: JSON.stringify({
          email,
          customFields: {
            welcomizerVideoURL,
          },
          tags: [CONFIG.BM_SEND_VIDEO_START_TAG],
        }),
      }
    );
  }

  async function listVideos() {
    const response = await listAll(listRef);
    let allFiles: string[] = [];
    response.items.forEach((iRef) => allFiles.push(iRef.name));
    return allFiles;
  }

  async function listVideosTailCall(): Promise<NodeJS.Timeout> {
    console.log(`listVideosTailCall`);

    // Get all videos that are not done in the database
    let videosNotProcessed = await prisma.videoNotification.findMany({
      where: {
        alreadyProcessed: false,
      },
      select: {
        id: true,
      },
    });

    console.log(`Videos not processed: ${videosNotProcessed.length}`);

    // If there are no videos being processed, just quit
    if (videosNotProcessed.length === 0)
      return setTimeout(() => listVideosTailCall(), 15 * 1000);

    // Else, call the list videos and see if my video was already processed
    let files = await listVideos();
    console.log({ files });

    // Get all files that are processed now, add their specific processed URLs

    let videosProcessed = await Promise.all(
      videosNotProcessed.map(async (v) => {
        let finalVideoName = files.find((f) => f.split("_")[0] === v.id);
        if (finalVideoName) {
          // Update the video URL
          let videoProcessed = await prisma.videoNotification.update({
            where: {
              id: v.id,
            },
            data: {
              alreadyProcessed: true,
              finalVideoName,
            },
          });

          return videoProcessed;
        }
      })
    );

    videosProcessed
      .filter((v) => v)
      .forEach(async (v) => {
        if (!v || !v.contactEmail) return;

        console.log(`Send email to ${v?.contactEmail}`);

        await sendVideoToBMContact({
          email: v.contactEmail,
          welcomizerVideoURL: `https://video.welcomizer.com/?video=${v.hash}`,
        });
      });

    return setTimeout(() => listVideosTailCall(), 15 * 1000);
  }

  // Start tail call loop
  listVideosTailCall();

  // Start server
  await app.listen(5060);
  console.log(`Listening on https://localhost:5060`);
}

run();
