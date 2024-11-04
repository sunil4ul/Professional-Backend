import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiError.js"
import { User } from "..//models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiRespones.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        
        const user = await User.findById( userId )
        //console.log("User :" , user)
        const accessToken = user.generateAccessToken()
        //console.log("Access Token : ",accessToken)
        const refreshToken = await user.generateRefreshToken() // problem occcured
        //console.log("Refresh Token :" , refreshToken)
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave:false})
        return {accessToken,refreshToken}
    } catch (error) {
        console.log("generateAccessAndRefreshTokens Error",error)
        throw new apiError(500, "Something Went Wrong While Generating Access or Refresh Token")
    }
}

const registerUser = asyncHandler( async (req, res) => {

// get user details from frontend....
// validation..not empty etc
// check if user already exist.. userName , E-mail etc
// check for image , check for avtar..
// upload them to cloudinary , avatar
// create user object - create entry in db
// remove password and refresh token field from response
// check for user creation 
// return response

const { name , email , phone , password , address} = req.body
console.log("E-mail :" , email);

    if (
        [name,email,phone,password,address].some((field)=>
            field?.trim() ==="" )
    ) {
        throw new apiError(400,"All Field are required")
    }

    const existedUser = await User.findOne({
        $or:[{email},{phone}]
    })

    if (existedUser){
        throw new apiError(409,"User with Email or Phone is already exist")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path ;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path ;

    let coverImageLocalPath ;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0) {
        coverImageLocalPath = req.files.coverImage[0].path 
    }

    //console.log(req.files);

    if (!avatarLocalPath) {
        
        throw new apiError(400,"Avatar File is Required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new apiError(400,"Avatar File is Required")
    }

    const user = await User.create({
        name,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        password,
        phone,
        address,
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    //console.log("User Created !!-1")
    if (!createdUser) {
        throw new apiError(500,"Something Went Wrong While Registering The User...")
    }
    
    res.status(200).json(
        new apiResponse(200,createdUser,"User Registered Successfully...")
    )
    //res.status(201).json({createdUser})
    //User.findOne({email})
// if(name === ""){
    //     throw new apiError(400,"Full Name Is required")
    // }

    // just for test........
    // res.status(200).json({
    //     message:"ok"
    // })

})

const loginUser = asyncHandler( async ( req,res )=> {

    // todos
    // req body -> data
    // phone or email to access the user for login
    // find the user
    // password check
    // access and refresh token
    // send cookeis
    // send response

    const { email , phone , password } = req.body
    if (!(email || phone )) {
        throw new apiError(400,"Email or Phone number is required")
    }

    const user = await User.findOne({
        $or:[{email},{phone}]
    })

    if (!user) {
        throw new apiError(404,"User Does not exit with given Email or Phone please try to Register the User First")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if (!isPasswordValid) {
        throw new apiError(401,"Invalid User Credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .cookie( "accessToken" , accessToken, options )
    .cookie( "refreshToken" , refreshToken , options )
    .json(
        new apiResponse (
            200,
            {
                user : loggedInUser , accessToken , refreshToken
            },
            "User Logged In Successfully"
        )
    )

})

const logOutUser = asyncHandler (async (req,res) =>{

    await User.findByIdAndUpdate(
        req.user._id,
        // {
        //     $set:{
        //         refreshToken: undefined
        //     }
        // }
        {
            $unset: {
                refreshToken: 1
            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new apiResponse(200,{}, "User Logged Out Successfully"))
})

const refreshAccessToken = asyncHandler( async (req , res) =>{

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new apiError(401 , "Unthorized Refresh Token request")
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new apiError(401 , "Invalid Refresh Token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new apiError(401 , "Refresh Token Expired or Used")
        }
    
        const options = {
            httpOnly:true,
            secure:true
        }
    
        const {accessToken , newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new apiResponse(
                200,
                {accessToken,refreshToken: newRefreshToken},
                "Access Token Refreshed Successfully !"
    
            )
        )
    } catch (error) {
        throw new apiError(401,error?.message || "Something went wrong while refreshing Access Token")
    }
})

const changeCurrentPassword = asyncHandler( async ( req, res ) => {
    const { oldPassword , newPassword } = req.body
    
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = user.isPasswordCorrect(oldPassword)
    
    if (!isPasswordCorrect) {
        throw new apiError(400, "Invalid old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(
        new apiResponse(200,{},"Password Changed Successfully")
    )

})

const getCurrentUser = asyncHandler( async (req, res) => {

    return res
    .status(200)
    .json(new apiResponse(200,req.user,"Current User Fetched Successfully"))
})

const updateAccountDetails = asyncHandler (async (req,res) => {
    const {name , email } = req.body
    
    if (!(name || email)) {
        throw new apiError(401, " Provide atleast a fieled that you want to update !!")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                name:name,
                email:email
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(200,{user},"Account Details Updated Successfully")
    )
})

const updateUserAvatar = asyncHandler(async (req,res) => {

    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new apiError(400,"Avatar File is missing ...")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if (!avatar.url) {
        throw new apiError(400,"Something went Error while Avatar File is uploading ...")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {
           new:true 
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(200,user,"Avatar is updated successfully !")
    )

})

const updateUserCoverImage = asyncHandler(async (req,res) => {

    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new apiError(400,"Cover Image File is missing ...")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!coverImage.url) {
        throw new apiError(400,"Something went Error while Cover Image File is uploading ...")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {
           new:true 
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(200,user,"Cover Image is updated successfully !")
    )

})

const getUserChannelProfile = asyncHandler( async (req,res) => {

    const { username } = req.params

    if (!username?.trim()) {
        throw new apiError(400,"User Name is Missing...")
    }

    const channel = await User.aggregate([
        {
            $match:{
                username:username?.toLowerCase(),
                
            }
        },
        {
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        { 
            $lookup:{
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size: "$subscribers"
                },
                channelSubscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if: { $in: [req.user?._id,"$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project:{
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelSubscribedToCount : 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    //console.log("Channel Value : ",channel)
    if (!channel?.length) {
        throw new  apiError(404,"Channel Does not Exist...")
    }

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            channel[0],
            "User Channel Value Feteched Successfully"
        )
    )

})

const getWatchHistory = asyncHandler (async (req,res) => {

    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                    $project: {
                                        name: 1,
                                        email : 1,
                                        phone: 1,
                                        avatar: 1,
                                        coverImage: 1

                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            user[0].watchHistory,
            "Watch History Fetched Successfully"

        )
    )
})

export { 
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
 }