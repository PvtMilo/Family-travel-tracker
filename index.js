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

const checkPersonCountries = async (userIdReq) => {
  const result = await db.query(
    "SELECT name,color,country_code,person_id FROM family_members INNER JOIN visited_countries ON family_members.id = visited_countries.person_id WHERE person_id = $1",
    [userIdReq],
  );
  let countries = [];
  result.rows.forEach((element) => {
    countries.push(element.country_code);
  });
  const color = result.rows[0].color;
  return { countries, color };
};

async function checkVisisted() {
  const result = await db.query("SELECT country_code FROM visited_countries");
  let countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });
  return countries;
}

app.get("/", async (req, res) => {
  const countries = await checkVisisted();
  const users = await checkFamilyMembers();
  res.render("index.ejs", {
    countries: countries,
    total: countries.length,
    users: users,
    color: "teal",
    userid: null
  });
});

app.get("/user/:id", async (req,res) => {
  let userIdSelected = parseInt(req.params.id)
      try {
      const { countries, color } = await checkPersonCountries(userIdSelected);
      const users = await checkFamilyMembers();
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: color,
        userid: userIdSelected
      });
    } catch (error) {
      // console.log(error);
      res.redirect("/?error=failed-query");
    }
})

app.post("/add", async (req, res) => {
  const input = req.body["country"];
  const userIdSelected = req.body.user_id
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
  const { user } = req.body;
  const { add } = req.body;
  console.log("/user post : ", user)
  if (add) {
    try {
      res.render("new.ejs");
    } catch (error) {
      console.log("error to new.ejs");
    }
  } else {
    try {
      const { countries, color } = await checkPersonCountries(user);
      const users = await checkFamilyMembers();
      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: color,
        userid: user
      });
    } catch (error) {
      // console.log(error);
      res.redirect("/?error=failed-query");
    }
  }
});

app.post("/new", async (req, res) => {
  //Hint: The RETURNING keyword can return the data that was inserted.
  //https://www.postgresql.org/docs/current/dml-returning.html
  res.send("new user added!");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
