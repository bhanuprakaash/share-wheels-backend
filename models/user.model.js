const bcrypt = require('bcryptjs');
const config = require('../config/env');

class User {
  constructor(dbClient, pgp){
    this.db = dbClient;
    this.pgp = pgp
  }

  async create(user) {
    const {
      email,
      phone_number,
      password,
      first_name,
      last_name,
      profile_picture,
      date_of_birth,
      gender,
      bio,
    } = user;

    try {
      return await this.db.tx(async (t) => {
        const userQuery = `
          INSERT INTO users (email, phone_number, password, first_name, last_name, profile_picture,
                             date_of_birth, gender, bio)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING user_id
        `;

        const userValues = [
          email,
          phone_number,
          password,
          first_name,
          last_name,
          profile_picture,
          date_of_birth,
          gender,
          bio,
        ];
        const newUser = await t.one(userQuery, userValues);

        const preferenceQuery = `
          INSERT INTO user_preferences (user_id)
          VALUES ($1)
          RETURNING *
        `;

        await t.one(preferenceQuery, [newUser.user_id]);

        return newUser;
      });
    } catch (err) {
      throw err;
    }
  }

  async findByUserId(userId) {
    const query = `
      SELECT email,
             user_id,
             phone_number,
             first_name,
             last_name,
             profile_picture,
             date_of_birth,
             gender,
             bio,
             fcm_tokens,
             wallet,
             hold_amount,
             is_active,
             created_at
      FROM users
      WHERE user_id = $1`;
    try {
      return await this.db.oneOrNone(query, [userId]);
    } catch (err) {
      throw err;
    }
  }

  async findByEmail(email) {
    const query = `
      SELECT email,
             user_id,
             phone_number,
             first_name,
             last_name,
             profile_picture,
             date_of_birth,
             gender,
             bio,
             fcm_tokens,
             is_active,
             wallet,
             hold_amount,
             password
      FROM users
      WHERE email = $1`;
    try {
      return await this.db.oneOrNone(query, [email]);
    } catch (err) {
      throw err;
    }
  }

  async update(userId, updateData) {
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

    const condition = this.pgp.as.format(' WHERE user_id = $1', [userId]);
    const updateQuery =
      this.pgp.helpers.update(cleanData, null, 'users') +
      condition +
      ' RETURNING user_id, email, first_name, last_name, profile_picture, date_of_birth, gender, bio, is_active, fcm_tokens, wallet, hold_amount, phone_number';

    try {
      return await this.db.oneOrNone(updateQuery);
    } catch (err) {
      throw err;
    }
  }

  async delete(userId) {
    const query = `
      DELETE
      FROM users
      WHERE user_id = $1
      RETURNING user_id`;
    try {
      return await this.db.oneOrNone(query, [userId]);
    } catch (err) {
      throw err;
    }
  }

  async getWalletBalanceByUserId(transaction = this.db, userId) {
    try {
      const query = `
        SELECT wallet, hold_amount
        FROM users
        WHERE user_id = $1
      `;
      return await transaction.oneOrNone(query, [userId]);
    } catch (err) {
      throw err;
    }
  }

  async updateBalance(transaction, userId, columnName, amount) {
    try {
      const column = this.pgp.as.name(columnName);
      const query = `
      UPDATE users
      SET ${column} = ${column} + $1
      WHERE user_id = $2
      RETURNING wallet, hold_amount
    `;
      const params = [amount, userId];

      const result = await transaction.oneOrNone(query, params);

      if (!result) {
        throw new Error(`User with ID ${userId} not found for balance update`);
      }

      return result;
    } catch (error) {
      throw error;
    }
  }

  async updateLastLogin(userId) {
    const query = `
      UPDATE users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;

    try {
      await this.db.none(query, [userId]);
    } catch (err) {
      throw err;
    }
  }

  async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async verifyPassword(userId, currentPassword) {
    try {
      const query = 'SELECT password from users WHERE user_id=$1';
      const user = await this.db.oneOrNone(query, [userId]);
      if (!user) return false;
      return await this.comparePassword(currentPassword, user.password);
    } catch (err) {
      throw err;
    }
  }

  async updatePassword(userId, newPassword) {
    try {
      const hashedPassword = await bcrypt.hash(
        newPassword,
        config.BCRYPT_ROUNDS
      );
      const query = `UPDATE users
                     SET password   = $1,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = $2
                     RETURNING user_id, email`;
      return await this.db.oneOrNone(query, [hashedPassword, userId]);
    } catch (err) {
      throw err;
    }
  }

  async updatePreferences(userId, updateData) {
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
    const condition = this.pgp.as.format(' WHERE user_id = $1', [userId]);
    const updateQuery =
      this.pgp.helpers.update(cleanData, null, 'user_preferences') +
      condition +
      ' RETURNING user_id, allow_smoking, music_genre, has_pets, is_pet_friendly, communication_preference, seat_preference';
    try {
      return await this.db.oneOrNone(updateQuery);
    } catch (err) {
      throw err;
    }
  }

  async findPreferencesByID(userId) {
    const query = `
      SELECT allow_smoking,
             music_genre,
             has_pets,
             is_pet_friendly,
             communication_preference,
             seat_preference,
             user_id
      FROM user_preferences
      WHERE user_id = $1`;
    try {
      return await this.db.oneOrNone(query, [userId]);
    } catch (err) {
      throw err;
    }
  }

  async addFcmToken(userId, newToken) {
    try {
      const query = `
        UPDATE users
        SET fcm_tokens = array_append(fcm_tokens, $1)
        WHERE user_id = $2
          AND NOT ($1 = ANY (fcm_tokens))
      `;
      await this.db.oneOrNone(query, [newToken, userId]);
    } catch (err) {
      throw err;
    }
  }

  async removeFcmTokens(userId, tokensToRemove) {
    if (!Array.isArray(tokensToRemove) || tokensToRemove.length === 0) {
      return;
    }
    try {
      for (const token of tokensToRemove) {
        await this.db.oneOrNone(
          `
            UPDATE users
            SET fcm_tokens=array_remove(fcm_tokens, $1)
            WHERE user_id = $2
          `,
          [token, userId]
        );
      }
    } catch (err) {
      throw err;
    }
  }
}

module.exports = User;
