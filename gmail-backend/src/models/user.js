import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    picture: { type: String, default: "" },
    name: { type: String, default: "" },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    tokenExpiry: { type: Number, required: true },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", UserSchema);
