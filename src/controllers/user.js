const express = require('express');
const redis = require('ioredis');
const nodemailer = require('nodemailer');
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
dotenv.config();
const jwt = require('jsonwebtoken');
const User = require("../models/user")
const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_SERVICE = process.env.EMAIL_SERVICE;
const EMAIL_USERNAME = process.env.EMAIL_USERNAME;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM;
const app = express();
// Configure Redis
const redisClient = new redis();
// Configure Nodemailer
const getTransporter = () => {
  return nodemailer.createTransport({
    // Configure your email service provider here
    service: "gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "prashanthberi00@gmail.com",
      pass: "atbkmetroanqoisf",
    },
  });
 } 

// Routes

// User registration
exports.register = async (req, res) => {
  try {
    console.log(req.body);
    const user = await User.create(req.body);
    // Generate a verification token
    const verificationCode = generateVerificationCode();
    // Store user data and token in Redis
redisClient.set(req.body.email, verificationCode, (err,reply) => {
  if (err) {
    console.error(err);
  } else {
    console.log(reply); // Should print 'OK'
  }
});

    // Send a verification email
    sendVerificationEmail(req.body.email, verificationCode);
    res.json({
      message: "for Registration . Check your email for verification.",
      status: true,
      result: user,
    });
  } catch (error) {
    res.json({ message: error.message, status: false });
  }
}
// Email verification
exports.verify = async (req, res) => {
  const email = req.body.email;
  const userEnteredCode = req.body.code;
  
  // Retrieve the saved verification code from Redis
  redisClient.get(email, (err, verificationCode) => {
    if (err) {
      res.status(500).send("Error accessing Redis");
      
    } else {
      console.log(verificationCode);//should display verification code
    }
    if (verificationCode === userEnteredCode) {

            
      // Verification successful, you can proceed with registration
      res.send("Email verified and registration complete!");
    } else {
      res.status(401).send("Invalid verification code");
    }
     
  });
  // try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({
        msg: "user doesnt exists",
      });
    }
    //updating user verification
    user.isVerified = true;
    await user.save();
  //   return res.status(200).send({
  //     message: "Account Verified",
  //   });
  // } catch (error) {
  //   return res.status(500).send(error);
  // }
}

// User login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return next(new ("Please provide email and password.", 400)());
    }

    const user = await User.findOne({ email }).select("+password");
  

    if (!user)
      return res.status(401).json({
        msg:
          "The email address " +
          email +
          " is not associated with any account. Double-check your email address and try again.",
      });
    //validate password
    const isPasswordCorrect = await user.isValidPassword(password);
    if (!isPasswordCorrect) {
      return next(new ("Email or password doesnot match or exist.", 400)());
    }
    res.status(200).json({ token: user.getJwtToken(), user: user });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}


  // Helper functions

//  
function generateVerificationCode() {
  // Generate a random token (you can use libraries like `crypto` for stronger tokens)
  return (
    Math.random().toString(4).substring(2, 15) +
    Math.random().toString(4).substring(2, 15)
  );
}

async function sendVerificationEmail(email, code) {
  const transporter = getTransporter();
  console.log("--------------------")
  // Send an email with a link that includes the verification token
  const mailOptions = {
    from: "prashanthberi00@gmail.com",
    to: "sasssy@chapsmail.com",
    subject: "Email Verification",
    text: `Click the following link to verify your email: http://localhost:8005/verify/${code}`,
  };

  // console.log("trasnporter", transporter)
  const info = await transporter.sendMail(mailOptions);
  console.log("info", info);
}

exports.delete = async (req, res) => {
  try {
    const getUserById = await User.findByIdAndDelete(req.param.id);
    res.send({
      message: "User has been deleted successfully",
      status: true,
      result: getUserById,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "User didnt deleted",
    });
  }
};
exports.forgetPassword=async(req,res)=>{
  const  email  = req.body.email;

  // Find the user by email 
const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Generate a password reset token and send it via email
  const resetToken = generateResetToken();
sendResetEmail(email, resetToken);
  res.status(200).json({ message: 'Password reset request sent successfully' });
};
//reset the password using the reset token
exports.resetPassword=async(req,res)=>{
  const { email, resetToken, newPassword } = req.body;

  // Verify the reset token (you should check against the stored token and its expiration time)
  const validToken = verifyResetToken(email, resetToken);

  if (!validToken) {
    return res.status(400).json({ message: 'Invalid or expired reset token' });
  }
  // Find the user by email
  const user = await User.findOne({ email });
if (!user) {
  return res.status(404).json({ message: 'User not found' });
  }
  // Hash the new password and update the user's password
  user.password = newPassword;
  await user.save()
 res.status(200).json({ message: 'Password reset successful' });
};
//helper functions
function generateResetToken() {
  return (
    Math.random().toString(4).substring(2, 15) +
    Math.random().toString(4).substring(2, 15)
);
}
async function sendResetEmail(email, resetToken) {
  const transporter = getTransporter();
  // Send an email with a link that includes the verification token
  const mailOptions = {
    from: "prashanthberi00@gmail.com",
    to: "sasssy@chapsmail.com",
    subject: "reset password",
    text: `Click the following link to verify your email: http://localhost:8005/reset/${resetToken}`,
  };

  // console.log("transporter", transporter)
  const info = await transporter.sendMail(mailOptions);
  console.log("info", info);
}
async function verifyResetToken(email, resetToken) {
  // Look up the user in your database by email
const user = await User.findOne({ email });
  // If the user is not found, or if the stored reset token does not match the one provided, it's invalid.
  if (!user || user.resetToken !== resetToken) {
    return false;
  }

  // Check if the token has expired
  const tokenExpirationTime = user.resetTokenExpiration; // This should be stored in our database
  const currentTime = new Date().getTime();

  if (currentTime > tokenExpirationTime) {
    return false; // Token has expired
  }
  return true; // Token is valid
}
// function hashPassword(password) {
//   return bcrypt.hash(password, 10);
// }
exports.update = async (req, res) => {
  try {
    const getUserById = await User.findByIdAndUpdate(req.param.id);
    res.send({
      message: "user has been updated successfully",
      status: true,
      result: getUserById,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({
      message: "user didnt updated",
    });
  }
};

