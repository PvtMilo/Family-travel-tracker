import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "admin",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const checkFamilyMembers = async () => {
  const result = await db.query("SELECT * FROM family_members");
  const family_members = result.rows;
  return family_members;
};

const checkPersonOnFamily = async (id) => {
  const result = await db.query(
    `SELECT * FROM family_members WHERE id = ${id}`,
  );
  return result.rows;
};

const insertPersonData = async (id) => {
  const result = await db.query(
    "INSERT INTO visited_countries(person_id) VALUES($1)RETURNING * ",
    [id],
  );
};

const checkPersonOnVisitedC = async (id) => {
  const result = await db.query(
    "SELECT person_id FROM visited_countries WHERE person_id = $1",
    [id],
  );
  const personData = result.rows;
  console.log(personData);
  console.log(typeof personData);
  return personData;
};

const checkPersonJoin = async (userIdReq) => {
  const result = await checkPersonOnVisitedC(userIdReq);
  console.log("from check visited country :", result.rows);
  if (!result.length > 0) {
    console.log("user table has not been joined");
  } else {
    try {
      const personData = await checkPersonOnFamily(userIdReq);
      if (!personData.length > 0) {
        console.log("person not found in the database");
      } else {
        console.log("inserting.......");
        try {
          const result = await insertPersonData(userIdReq);
          console.log("succesfully added specified user: ", result);
        } catch (error) {
          console.log("failed inserting.", error);
        }
      }
    } catch (error) {
      console.log("failed joining specified id", error);
    }
  }
};

const checkPersonCountries = async (userIdReq) => {
  try {
    const result = await db.query(
      "SELECT name,color,country_code,person_id FROM family_members INNER JOIN visited_countries ON family_members.id = visited_countries.person_id WHERE person_id = $1",
      [userIdReq],
    );
    console.log("checking data : ", result.rows);
    console.log(result.rows.length);
    if (!result.rows.length > 0) {
      try {
        const result = await checkPersonJoin(userIdReq);
        console.log(result);
      } catch (error) {
        console.log("error on check person countries function", error);
      }
    } else {
    }
    let countries = [];
    result.rows.forEach((element) => {
      countries.push(element.country_code);
    });
    const color = result.rows[0].color;
    return { countries, color };
  } catch (error) {
    console.log(error);
  }
};

const deleteNullCountryCode = async () => {
  const result = await db.query("DELETE FROM visited_countries WHERE country_code is NULL")
}

async function checkVisisted() {
  const result = await db.query("SELECT country_code FROM visited_countries");
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

// API ENDPOINT

app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const users = await checkFamilyMembers();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: "teal",
    userid: null,
  });
});

app.get("/user/:id", async (req, res) => {
  let userIdSelected = parseInt(req.params.id);
  try {
    const { countries, color } = await checkPersonCountries(userIdSelected);
    const users = await checkFamilyMembers();
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: color,
      userid: userIdSelected,
    });
  } catch (error) {
    console.log(error);
    res.redirect("/?error=failed-query");
  }
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const userIdSelected = req.body.user_id;
  try {
    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE '%' || $1 || '%';",
      [input.toLowerCase()],
    );
    const data = result.rows[0];
    const countryCode = data.country_code;
    try {
      await db.query(
        "INSERT INTO visited_countries (country_code,person_id) VALUES ($1, $2)",
        [countryCode, userIdSelected],
      );
      deleteNullCountryCode()
      res.redirect("/user/" + userIdSelected);
    } catch (err) {
      // console.log(err, "error inserting data");
      res.redirect("/?error=error-inserting-data");
    }
  } catch (err) {
    console.log(err, "data not found!");
    res.redirect("/?error=data-not-found");
  }
});

app.post("/user", async (req, res) => {
  const { user, add } = req.body;
  console.log(user);
  console.log(add);
  if (add) {
    try {
      res.render("new.ejs");
    } catch (error) {
      console.log("error to new.ejs");
    }
  } else {
    const result = await checkPersonOnVisitedC(user);
    // console.log("Result from checkC : ", result);
    // console.log(typeof result);
    // console.log("result from post  :" , result);
    // console.log("result from post LENGTH :" ,result.length)
    if (!result.length > 0) {
      console.log("user not on country table");
      try {
        const result = insertPersonData(user);
        console.log("inserting inside /post : ", result.rows);
        res.redirect(`/user/${user}`);
      } catch (error) {
        console.log("failed inserting inside /post : ", result.rows);
      }
    } else {
      console.log("/user post : ", user);
      try {
        const { countries, color } = await checkPersonCountries(user);
        const users = await checkFamilyMembers();
        res.render("index.ejs", {
          countries: countries,
          total: countries.length,
          users: users,
          color: color,
          userid: user,
        });
      } catch (error) {
        console.log(error);
        res.redirect("/?error=failed-query");
      }
    }
  }
});

app.post("/new", async (req, res) => {
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html
  const { name, color } = req.body;
  // console.log(color.length)
  console.log(name.length);
  if (!name.length > 0 && !color) {
    return res.render("new.ejs", { error: "input the correct data!" });
  } else {
    console.log("data meet the req!");
    try {
      const result = await db.query(
        "INSERT INTO family_members (name,color) VALUES ($1, $2) RETURNING *;",
        [name, color],
      );
      console.log("Successfully added : ", result.rows);
    } catch (error) {
      console.log("failed inserting data!", error);
    }
  }
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
