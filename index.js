"use strict";
import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dotenv from "dotenv";
import shortUUID from "short-uuid";

dotenv.config();
const app = express();
const port = process.env.PORT;
const MONGO_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const mongoClient = new MongoClient(MONGO_CONNECTION_STRING);

app.use(express.json());
app.use(cors());

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
//3
app.get("/users", async (req, res) => {
  const connection = await mongoClient.connect();
  const data = await connection
    .db("Project1")
    .collection("users")
    .find()
    .toArray();
  await connection.close();
  res.send(data);
});

const schemaUser = joi.object({
  id: joi.required(),
  firstName: joi.string().required().max(50).pattern(/\s/, { invert: true }),
  lastName: joi.string().required().max(50).pattern(/\s/, { invert: true }),
  email: joi.string().required().email(),
});

//4
app.post("/users", async (req, res) => {
  const id = shortUUID.generate();
  const connection = await mongoClient.connect();
  const { firstName, lastName, email } = req.body;
  const newUser = { id, firstName, lastName, email };
  const isValid = schemaUser.validate(newUser);
  if (isValid.error) {
    res
      .status(400)
      .send({ success: false, error: isValid.error.details[0].message });
  }
  if (!isValid.error) {
    res.send({ success: true, user: newUser });
    const data = await connection
      .db("Project1")
      .collection("users")
      .insertOne(newUser);
  }
  res.send();
});
//5
app.post("/notes", async (req, res) => {
  const id = shortUUID.generate();
  const createdAt = new Date().getTime();
  const done = false;
  const schemaNotes = joi.object({
    id: joi.required(),
    userId: joi.required(),
    title: joi.string().max(50).required(),
    text: joi.string().required().max(1000),
    done: joi.required(),
    createdAt: joi.required(),
  });
  const connection = await mongoClient.connect();
  const { userId, title, text } = req.body;
  const newNote = { id, userId, title, text, done, createdAt };
  console.log(newNote);
  const isValid = schemaNotes.validate(newNote);
  const data = await connection
    .db("Project1")
    .collection("users")
    .find({
      id: userId,
    })
    .toArray();
  if (data.length > 0) {
    if (isValid.error) {
      res
        .status(400)
        .send({ success: false, error: isValid.error.details[0].message });
    } else {
      res.send({ success: true, note: newNote });
      const insertData = await connection
        .db("Project1")
        .collection("notes")
        .insertOne(newNote);
    }
  } else {
    res
      .status(400)
      .send({ success: false, error: "There is no user with that ID" });
  }
  res.send();
});
//6
app.get("/users/:userId/notes", async (req, res) => {
  const userId = req.params.userId;
  const date = req.query.date;

  const findObject = {
    userId: Number(userId),
  };

  if (date) {
    const dateFromString = `${date}T00:00:01`;
    const dateFrom = new Date(dateFromString);
    const timestampFrom = Number(dateFrom);

    const dateToString = `${date}T23:59:59`;
    const dateTo = new Date(dateToString);
    const timestampTo = Number(dateTo);

    findObject.createdAt = {
      $gte: timestampFrom,
      $lte: timestampTo,
    };
  }

  const connection = await mongoClient.connect();
  const notes = await connection
    .db("Project1")
    .collection("notes")
    .find(findObject)
    .project({ title: 1, userId: 1, createdAt: 1, done: 1, _id: 0 })
    .toArray();
  await connection.close();

  res.send(notes);
});
//7
app.get("/user/:USER_ID/note/:NOTE_ID", async (req, res) => {
  const userId = Number(req.params.USER_ID);
  const noteId = Number(req.params.NOTE_ID);
  const connection = await mongoClient.connect();
  const data = await connection
    .db("Project1")
    .collection("notes")
    .aggregate([
      {
        $match: {
          id: noteId,
          userId: userId,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "id",
          as: "user",
        },
      },
      {
        $project: {
          _id: 0,
          user: { $first: "$user" },
          title: 1,
          text: 1,
          done: 1,
          createdAt: 1,
        },
      },
    ])
    .toArray();
  console.log(userId, noteId);
  res.send(data);
});
//8
app.get("/users/:USER_ID", async (req, res) => {
  const userId = Number(req.params.USER_ID);
  const connection = await mongoClient.connect();
  const data = await connection
    .db("Project1")
    .collection("users")
    .aggregate([
      {
        $match: {
          id: userId,
        },
      },
      {
        $lookup: {
          from: "notes",
          localField: "id",
          foreignField: "userId",
          as: "notes",
        },
      },
      {
        $project: {
          id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          noteCount: { $size: "$notes" },
        },
      },
    ])
    .toArray();
  res.send(data);
});
//9
app.put("/user/:USER_ID/notes/:NOTE_ID/toggleStatus", async (req, res) => {
  const userId = Number(req.params.USER_ID);
  const noteId = Number(req.params.NOTE_ID);
  const connection = await mongoClient.connect();
  const data = await connection
    .db("Project1")
    .collection("notes")
    .aggregate([
      {
        $match: {
          id: noteId,
          userId: userId,
        },
      },
      {
        $project: {
          done: 1,
          _id: 0,
        },
      },
    ])
    .toArray();
  data[0].done = !data[0].done;
  const toggleDone = await connection
    .db("Project1")
    .collection("notes")
    .updateOne(
      {
        id: 101,
        userId: 1,
      },
      {
        $set: {
          done: data[0].done,
        },
      }
    );
  res.send(data);
});
