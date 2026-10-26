const router = require("express").Router();
const controller = require("../controllers/users.controller");
const validateId = require("../middleware/validate-id");

router.param("id", validateId("User"));
router.post("/", controller.create);
router.get("/", controller.list);
router.get("/:id/posts", controller.getPosts);
router.get("/:id/liked-posts", controller.getLikedPosts);
router.get("/:id", controller.getOne);
router.patch("/:id", controller.update);
router.delete("/:id", controller.remove);

module.exports = router;
