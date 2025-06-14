const UserService = require('../services/user.service');

const userController = {
    async createUser(req, res, next) {
        try {
            const user = await UserService.createUser(req.body);
            res.status(201).json({
                message: 'User created successfully',
                success: true,
                data: user
            });
        } catch (err) {
            next(err);
        }
    },
    async loginUser(req, res, next) {
        try {
            const {email, password} = req.body;
            const result = await UserService.authenticateUser(email, password);
            res.json({
                success: true,
                message: 'Login Successful',
                data: result
            })
        } catch (err) {
            next(err);
        }
    },
    async getUser(req, res, next) {
        try {
            const {id} = req.params;
            const user = await UserService.getUserById(id);
            res.json({
                success: true,
                data: user
            })
        } catch (err) {
            next(err);
        }
    },
    async updateUser(req, res, next) {
        try {
            const {id} = req.params;
            const user = await UserService.updateUser(id, req.body);
            res.json({
                success: true,
                message: 'User updated Successfully',
                data: user
            })
        } catch (err) {
            next(err);
        }
    },
    async deleteUser(req, res, next) {
        try {
            const {id} = req.params;
            const result = await UserService.deleteUser(id);
            res.json({
                success: true,
                message: 'User Deleted Successfully',
                data: result
            })
        } catch (err) {
            next(err);
        }
    },
    async updateUserPassword(req, res, next) {
        try {
            const {id} = req.params;
            const {currentPassword, newPassword} = req.body;
            const result = await UserService.updateUserPassword(id, currentPassword, newPassword);
            res.json({
                success: true,
                data: result,
                message: "Password Updated Successfully"
            })
        } catch (err) {
            next(err);
        }
    },
    async updateUserPreferences(req, res, next) {
        try {
            const {id} = req.params;
            const preferences = await UserService.updateUserPreferences(id, req.body);
            res.json({
                success: true,
                message: 'User Preferences Updated Successfully',
                data: preferences
            })
        } catch (err) {
            next(err);
        }

    },
    async getUserPreferences(req, res, next) {
        try {
            const {id} = req.params;
            const preferences = await UserService.getUserPreferences(id);
            res.json({
                success:true,
                data:preferences
            })
        } catch (err){
            next(err);
        }
    }
};

module.exports = userController;