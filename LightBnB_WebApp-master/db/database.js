const properties = require("./json/properties.json");
const users = require("./json/users.json");

const { pool } = require("./index");


/// Users

/**
 * Get a single user from the database given their email.
 * @param {String} email The email of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithEmail = function (email) {
  
  return pool
    .query(
      `SELECT * FROM users WHERE email = $1;`, [email]
      )
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
    });
};

/**
 * Get a single user from the database given their id.
 * @param {string} id The id of the user.
 * @return {Promise<{}>} A promise to the user.
 */
const getUserWithId = function (id) {
  return pool
    .query(
      `SELECT * FROM users WHERE id = $1;`, [id]
      )
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
    });
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user
 * @return {Promise<{}>} A promise to the user.
 */
const addUser = function (user) {
  // const userId = Object.keys(users).length + 1;
  // user.id = userId;
  // users[userId] = user;
  // return Promise.resolve(user);

  return pool
    .query(
      `INSERT INTO users (name, email, password) VALUES($1, $2, $3) RETURNING *;`, 
      [user.name, user.email, user.password]
      )
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
    });
};

/// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id The id of the user.
 * @return {Promise<[{}]>} A promise to the reservations.
 */
const getAllReservations = function (guest_id, limit = 10) {

  return pool
    .query(
      `SELECT 
      reservations.id, reservations.start_date, reservations.end_date, properties.*, 
      AVG(rating) as average_rating
      FROM reservations
      JOIN properties ON reservations.property_id = properties.id
      JOIN property_reviews ON property_reviews.property_id = properties.id
      WHERE reservations.guest_id = $1
      GROUP BY properties.id, reservations.id
      ORDER BY start_date
      LIMIT $2;`, [guest_id, limit]
      )
    .then((result) => {
      return result.rows;
    })
    .catch((err) => {
      console.log(err.message);
    });
};

/// Properties

/**
 * Get all properties.
 * @param {{}} options An object containing query options.
 * @param {*} limit The number of results to return.
 * @return {Promise<[{}]>}  A promise to the properties.
 */
const getAllProperties = function (options, limit = 100) {

  // 1
  const queryParams = [];
  // 2
  let queryString = `
  SELECT properties.*, avg(property_reviews.rating) as average_rating
  FROM properties
  JOIN property_reviews ON properties.id = property_id
  `;

  // 3
  if (options.city) {
    queryParams.push(`%${options.city}%`);
    queryString += `WHERE city LIKE $${queryParams.length} `;
  }

  // Owner ID provided
  if (options.owner_id) {
    queryParams.push(`${options.owner_id}`);
    queryString += `WHERE owner_id = $${queryParams.length} `;
  }

  // Both Minimum and Maximum Value provided
  if (options.minimum_price_per_night && options.maximum_price_per_night) {
    if (queryParams.length === 0) {
      queryParams.push(`${options.minimum_price_per_night * 100}`);
      queryString += `WHERE cost_per_night BETWEEN $${queryParams.length} `;
      queryParams.push(`${options.maximum_price_per_night * 100}`);
      queryString += `AND $${queryParams.length} `;
    }
    else {
      queryParams.push(`${options.minimum_price_per_night * 100}`);
      queryString += `AND cost_per_night BETWEEN $${queryParams.length} `;
      queryParams.push(`${options.maximum_price_per_night * 100}`);
      queryString += `AND $${queryParams.length} `;
    }
  }

  // Minimum Price per Night
  if (options.minimum_price_per_night && !options.maximum_price_per_night) {
    if (queryParams.length === 0) {
      queryParams.push(`${options.minimum_price_per_night * 100}`);
      queryString += `WHERE cost_per_night >= $${queryParams.length} `;
    }
    else {
      queryParams.push(`${options.minimum_price_per_night * 100}`);
      queryString += `AND cost_per_night >= $${queryParams.length} `;
    }
  }

  // Maximum Price per Night
  if (!options.minimum_price_per_night && options.maximum_price_per_night) {
    if (queryParams.length === 0) {
      queryParams.push(`${options.maximum_price_per_night * 100}`);
      queryString += `WHERE cost_per_night <= $${queryParams.length} `;
    }
    else {
      queryParams.push(`${options.maximum_price_per_night * 100}`);
      queryString += `AND cost_per_night <= $${queryParams.length} `;
    }
  }

  queryString += `
  GROUP BY properties.id `;

  // Minimum Rating of Properties
  if (options.minimum_rating) {
    queryParams.push(`${options.minimum_rating}`);
    queryString += `HAVING avg(rating) >= $${queryParams.length} `;
  }

  // 4
  queryParams.push(limit);
  queryString += `
  ORDER BY cost_per_night
  LIMIT $${queryParams.length};
  `;

  // 5
  // console.log(queryString, queryParams);

  // 6
  return pool.query(queryString, queryParams).then((res) => res.rows);
};

/**
 * Add a property to the database
 * @param {{}} property An object containing all of the property details.
 * @return {Promise<{}>} A promise to the property.
 */
const addProperty = function (property) {
  
  const queryParamTitle = [
    'title', 'description', 'owner_id', 'cover_photo_url', 'thumbnail_photo_url', 
    'cost_per_night', 'parking_spaces', 'number_of_bathrooms', 'number_of_bedrooms',
    'province', 'city', 'country', 'street', 'post_code'
  ];

  const queryParams = [];

  for (prop of queryParamTitle) {
    queryParams.push(property[prop]);
  }

  const queryString = `
  INSERT INTO properties (
    title, description, owner_id, cover_photo_url, thumbnail_photo_url, 
    cost_per_night, parking_spaces, number_of_bathrooms, number_of_bedrooms,
    province, city, country, street, post_code) 
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
    ) RETURNING *;
  `;

    
  return pool.query(queryString, queryParams)
    .then((result) => {
      return result.rows[0];
    })
    .catch((err) => {
      console.log(err.message);
    });
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
