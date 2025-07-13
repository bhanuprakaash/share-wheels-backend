const jwt = require('jsonwebtoken');
const config = require('../config/env');
const bcrypt = require('bcryptjs');

class UserService {

  constructor(userRepository){
    this.userRepository = userRepository;
  }

  async createUser(userData) {
    try {
      const [, hashedPassword] = await Promise.all([
        this.validateUser(userData),
        bcrypt.hash(userData.password, config.BCRYPT_ROUNDS),
      ]);
      return await this.userRepository.create({ ...userData, password: hashedPassword });
    } catch (err) {
      throw new Error(`User Creation Failed: ${err.message}`);
    }
  }

  async validateUser(userData) {
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists');
    }
  }

  async authenticateUser(email, password) {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new Error('Invalid Credential - Email');
      }
      const isValidPassword = await this.userRepository.comparePassword(
        password,
        user.password
      );
      if (!isValidPassword) {
        throw new Error('Invalid Credential - Password');
      }
      await this.userRepository.updateLastLogin(user.user_id);
      const token = jwt.sign(
        { userId: user.user_id, email: user.email },
        config.JWT_SECRET,
        { expiresIn: '24h' }
      );

      const { password: _, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token,
      };
    } catch (err) {
      throw err;
    }
  }

  async getUserById(userId) {
    try {
      const user = await this.userRepository.findByUserId(userId);
      if (!user) {
        throw new Error('User not found');
      }
      const { password: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      throw error;
    }
  }

  async updateUser(userId, updateData) {
    try {
      const user = await this.userRepository.update(userId, updateData);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  async updateUserBalance(transaction, userId, columnName, amount){
    try{
      const updatedData = await this.userRepository.updateBalance(transaction, userId, columnName, amount);
      return updatedData;
    } catch(err){
      throw err;
    }
  }

  async deleteUser(userId) {
    try {
      const result = await this.userRepository.delete(userId);
      if (!result) {
        throw new Error('User not found');
      }
      return { message: 'User deleted successfully' };
    } catch (error) {
      throw error;
    }
  }

  async updateUserPassword(userId, currentPassword, newPassword) {
    try {
      const isPasswordValid = await this.userRepository.verifyPassword(
        userId,
        currentPassword
      );
      if (!isPasswordValid) {
        throw new Error('Current Password is Wrong');
      }
      return await this.userRepository.updatePassword(userId, newPassword);
    } catch (err) {
      throw err;
    }
  }

  async updateUserPreferences(userId, updateData) {
    try {
      const preferences = await this.userRepository.updatePreferences(userId, updateData);
      if (!preferences) {
        throw new Error('User not found');
      }
      return preferences;
    } catch (err) {
      throw err;
    }
  }

  async getUserPreferences(userId) {
    try {
      const preferences = await this.userRepository.findPreferencesByID(userId);
      if (!preferences) throw new Error('User Not Found');
      return preferences;
    } catch (err) {
      throw err;
    }
  }

  async getUserWalletBalance(transaction, userId){
    try{
      return await this.userRepository.getWalletBalanceByUserId(transaction, userId);
    } catch(err){
      throw err;
    }
  }

  async removeFcmTokens(userId, tokensToRemove) {
    try {
      await this.userRepository.removeFcmTokens(userId, tokensToRemove);
    } catch (err) {
      throw err;
    }
  }

  async addNewFcmToken(userId, newToken) {
    try {
      await this.userRepository.addFcmToken(userId, newToken);
    } catch (err) {
      throw err;
    }
  }
}

module.exports = UserService;
