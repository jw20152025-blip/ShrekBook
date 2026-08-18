// ==================================================
// SHREKBOOK AUTH MIDDLEWARE
// ==================================================

function requireLogin(req, res, next) {

    if (
        !req.session ||
        !req.session.user ||
        !req.session.user.id
    ) {

        return res.status(401).json({
            error: "You must be logged in."
        });

    }

    next();

}


module.exports = {
    requireLogin
};