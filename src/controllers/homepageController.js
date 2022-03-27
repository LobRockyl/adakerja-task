// render homepage
let getHomepage = (req, res) => {
    return res.render("ejs/homepage.ejs");
};

module.exports = {
    getHomepage: getHomepage
};
