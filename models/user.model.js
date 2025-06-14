const {db, pgp} = require("../config/db");
const bcrypt = require("bcryptjs");
const config = require("../config/env");

class User {
    static async create(user) {
        const {
            email,
            phone_number,
            password,
            first_name,
            last_name,
            profile_picture,
            date_of_birth,
            gender,
            bio
        } = user;

        const hashedPassword = await bcrypt.hash(password, config.BCRYPT_ROUNDS);

        try {
            return await db.tx(async t => {
                const userQuery = `
                    INSERT INTO users (email, phone_number, password, first_name, last_name, profile_picture,
                                       date_of_birth, gender, bio)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING user_id
                `;

                const userValues = [email, phone_number, hashedPassword, first_name, last_name, profile_picture, date_of_birth, gender, bio];
                const newUser = await t.one(userQuery, userValues);

                const preferenceQuery = `
                    INSERT INTO user_preferences (user_id)
                    VALUES ($1) RETURNING *
                `;

                await t.one(preferenceQuery, [newUser.user_id]);

                return newUser;
            });
        } catch (err) {
            throw err;
        }
    }

    static async findByUserId(userId) {
        const query = `
            SELECT email,
                   password,
                   phone_number,
                   first_name,
                   last_name,
                   profile_picture,
                   date_of_birth,
                   gender,
                   bio
            FROM users
            WHERE user_id = $1`;
        try {
            return await db.oneOrNone(query, [userId]);
        } catch (err) {
            throw err;
        }
    }

    static async findByEmail(email) {
        const query = `
            SELECT user_id,
                   email,
                   phone_number,
                   password,
                   first_name,
                   last_name,
                   profile_picture,
                   date_of_birth,
                   gender,
                   bio,
                   is_active,
                   created_at,
                   updated_at,
                   last_login_at
            FROM users
            WHERE email = $1`;
        try {
            return await db.oneOrNone(query, [email]);
        } catch (err) {
            throw err;
        }
    }

    static async update(userId, updateData) {
        const cleanData = Object.keys(updateData).reduce((acc, key) => {
            if (updateData[key] !== undefined && key !== 'user_id') {
                acc[key] = updateData[key];
            }
            return acc;
        }, {});

        if (Object.keys(cleanData).length === 0) {
            throw new Error('No fields to update');
        }

        cleanData.updated_at = new Date().toISOString();

        const condition = pgp.as.format(' WHERE user_id = $1', [userId]);
        const updateQuery = pgp.helpers.update(cleanData, null, 'users') + condition +
            ' RETURNING user_id, email, phone_number, first_name, profile_picture, date_of_birth, gender, bio, is_active, created_at, updated_at';

        try {
            return await db.oneOrNone(updateQuery);
        } catch (err) {
            throw err;
        }
    }

    static async delete(userId) {
        const query = `
            DELETE
            FROM users
            WHERE user_id = $1 RETURNING user_id`;
        try {
            return await db.oneOrNone(query, [userId]);
        } catch (err) {
            throw err;
        }
    }

    static async updateLastLogin(userId) {
        const query = `
            UPDATE users
            SET last_login_at = CURRENT_TIMESTAMP
            WHERE user_id = $1
        `;

        try {
            await db.none(query, [userId]);
        } catch (err) {
            throw err;
        }
    }

    static async comparePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    static async verifyPassword(userId, currentPassword) {
        try {
            const query = 'SELECT password from users WHERE user_id=$1';
            const user = await db.oneOrNone(query, [userId]);
            if (!user) return false;
            return await this.comparePassword(currentPassword, user.password);
        } catch (err) {
            throw err;
        }
    }

    static async updatePassword(userId, newPassword) {
        try {
            const hashedPassword = await bcrypt.hash(newPassword, config.BCRYPT_ROUNDS);
            const query = `UPDATE users
                           SET password   = $1,
                               updated_at = CURRENT_TIMESTAMP
                           WHERE user_id = $2 RETURNING user_id, email, updated_at`;
            return await db.oneOrNone(query, [hashedPassword, userId])
        } catch (err) {
            throw err;
        }
    }

    static async updatePreferences(userId, updateData) {
        const cleanData = Object.keys(updateData).reduce((acc, key) => {
            if (updateData[key] !== undefined) {
                acc[key] = updateData[key];
            }
            return acc;
        }, {});
        if (Object.keys(cleanData).length === 0) {
            throw new Error('No fields to update');
        }
        cleanData.updated_at = new Date().toISOString();
        const condition = pgp.as.format(' WHERE user_id = $1', [userId]);
        const updateQuery = pgp.helpers.update(cleanData, null, 'user_preferences') + condition +
            ' RETURNING user_id, allow_smoking, music_genre, has_pets, is_pet_friendly, communication_preference, seat_preference, updated_at';
        try {
            return await db.oneOrNone(updateQuery);
        } catch (err) {
            throw err;
        }
    }

    static async findPreferencesByID(userId){
        const query = `
            SELECT allow_smoking, music_genre, has_pets, is_pet_friendly, communication_preference, seat_preference, updated_at
            FROM user_preferences
            WHERE user_id = $1`;
        try {
            return await db.oneOrNone(query, [userId]);
        } catch (err) {
            throw err;
        }
    }
}

module.exports = User;