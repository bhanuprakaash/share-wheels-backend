class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  createUser = async (req, res, next) => {
    try {
      const user = await this.userService.createUser(req.body);
      res.status(201).json({
        message: 'User created successfully',
        success: true,
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };
  loginUser = async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const result = await this.userService.authenticateUser(email, password);
      res.json({
        success: true,
        message: 'Login Successful',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
  getUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      res.json({
        success: true,
        data: user,
        message: 'User Data Fetched Successfully',
      });
    } catch (err) {
      next(err);
    }
  };
  getCurrentUser = async (req, res, next) => {
    try {
      const userId = req.user.userId; // getting from token
      const user = await this.userService.getUserById(userId);
      res.json({
        success: true,
        data: user,
        message: 'Current User Data Fetched Successfully',
      });
    } catch (err) {
      next(err);
    }
  };
  updateUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = await this.userService.updateUser(id, req.body);
      res.json({
        success: true,
        message: 'User updated Successfully',
        data: user,
      });
    } catch (err) {
      next(err);
    }
  };
  deleteUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await this.userService.deleteUser(id);
      res.json({
        success: true,
        message: 'User Deleted Successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  };
  updateUserPassword = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { currentPassword, newPassword } = req.body;
      const result = await this.userService.updateUserPassword(
        id,
        currentPassword,
        newPassword
      );
      res.json({
        success: true,
        data: result,
        message: 'Password Updated Successfully',
      });
    } catch (err) {
      next(err);
    }
  };
  updateUserPreferences = async (req, res, next) => {
    try {
      const { id } = req.params;
      const preferences = await this.userService.updateUserPreferences(
        id,
        req.body
      );
      res.json({
        success: true,
        message: 'User Preferences Updated Successfully',
        data: preferences,
      });
    } catch (err) {
      next(err);
    }
  };
  getUserPreferences = async (req, res, next) => {
    try {
      const { id } = req.params;
      const preferences = await this.userService.getUserPreferences(id);
      res.json({
        success: true,
        data: preferences,
        message: 'User Preferences Fetched Successfully',
      });
    } catch (err) {
      next(err);
    }
  };
  registerFcmToken = async (req, res, next) => {
    const { user_id } = req.params;
    try {
      await this.userService.addNewFcmToken(user_id, req.body.fcmToken);
      res.status(200).json({
        success: true,
        message: 'FCM token registered Successfully',
      });
    } catch (err) {
      next(err);
    }
  }
  unRegisterFcmToken = async (req, res, next) => {
    const { user_id } = req.params;
    try {
      await this.userService.removeFcmTokens(user_id, req.body.fcmToken);
      res.status(200).json({
        success: true,
        message: 'FCM token unregistered successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;
