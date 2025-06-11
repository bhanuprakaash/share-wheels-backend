const User = require("../models/User");
const jwt = require("jsonwebtoken");
const config = require("../config/env");

class UserService {
    static  async createUser(userData){
        try{
            await this.validateUser(userData);
            return await User.create(userData);
        } catch (err){
            throw new Error(`User Creation Failed: ${err.message}`);
        }
    }

    static async validateUser(userData){
        const existingUser = await  User.findByEmail(userData.email);
        if(existingUser){
            throw new Error('User already exists');
        }
    }

    static async authenticateUser(email, password){
        try{
            const user = await User.findByEmail(email);
            if(!user) {
                throw new Error('Invalid Credential - Email');
            }
            const isValidPassword = await User.comparePassword(password, user.password);
            if(!isValidPassword){
                throw new Error('Invalid Credential - Password');
            }
            await User.updateLastLogin(user.user_id);
            const token = jwt.sign(
                { userId: user.user_id, email: user.email },
                config.JWT_SECRET,
                { expiresIn: '24h' }
            );

            const { password: _, ...userWithoutPassword } = user;

            return {
                user: userWithoutPassword,
                token
            };
        } catch(err){
            throw err;
        }
    }

    static async getUserById(userId){
        try{
            const user = await User.findByUserId(userId);
            if (!user){
                throw new Error('User not found');
            }
            const { password: _, ...userWithoutPassword } = user;
            return userWithoutPassword;
        } catch(error){
            throw error;
        }
    }

    static async updateUser(userId, updateData){
        try {
            const user = await User.update(userId, updateData);
            if (!user) {
                throw new Error('User not found');
            }
            return user;
        } catch (error) {
            throw error;
        }
    }

    static async deleteUser(userId) {
        try {
            const result = await User.delete(userId);
            if (!result) {
                throw new Error('User not found');
            }
            return { message: 'User deleted successfully' };
        } catch (error) {
            throw error;
        }
    }

    static async updateUserPassword(userId, currentPassword, newPassword){
        try{
            const isPasswordValid = await User.verifyPassword(userId, currentPassword);
            if (!isPasswordValid){
                throw new Error("Current Password is Wrong");
            }
            return await User.updatePassword(userId, newPassword);
        } catch (err){
            throw err;
        }
    }

    static async updateUserPreferences(userId, updateData){
        try{
            const preferences = await User.updatePreferences(userId, updateData);
            if (!preferences) {
                throw new Error('User not found');
            }
            return preferences;
        } catch (err){
            throw err;
        }
    }

    static async getUserPreferences(userId){
        try{
            const preferences = await User.findPreferencesByID(userId);
            if(!preferences) throw new Error("User Not Found");
            return preferences;
        } catch (err){
            throw err;
        }
    }
}

module.exports = UserService;