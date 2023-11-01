const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
// const jwt=require("../middlewares/jwt")
const jwt=require("jsonwebtoken")


const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      required: "Your email is required",
      trim: true,
    },

    username: {
      type: String,
      unique: true,
      required: "Your username is required",
    },

    password: {
      type: String,
      required: "Your password is required",
      max: 100,
    },

    firstName: {
      type: String,
      required: [true,"First Name is required"],
      max: [20, "dfghj"],
    },

    lastName: {
      type: String,
      required: [true,"Last Name is required"],
      max: [20,"hsydgy"],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: String,
    verificationCodeExpiry: Date,
    // resetToken: String,
    // resetTokenExpiration: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }
);

UserSchema.pre("save", function (next) {
  const user = this;

  if (!user.isModified("password")) return next();

  bcrypt.genSalt(10, function (err, salt) {
    if (err) return next(err);

    bcrypt.hash(user.password, salt, function (err, hash) {
      if (err) return next(err);

      user.password = hash;
      next();
    });
  });
});

// validate the password with passed on user password
UserSchema.methods.isValidPassword = async function(usersendPassword) {
    return await bcrypt.compare(usersendPassword, this.password)
}


// validating the token and returning it
UserSchema.methods.getJwtToken = function () {
 

  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn:"1h",
  });
};


module.exports = mongoose.model("User", UserSchema);
