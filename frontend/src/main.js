import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import HomePage from "./pages/HomePage.vue";
import ChatPage from "./pages/ChatPage.vue";
import RankPage from "./pages/RankPage.vue";
import AgentCenterPage from "./pages/AgentCenterPage.vue";
import FeedbackPage from "./pages/FeedbackPage.vue";
import JoinPage from "./pages/JoinPage.vue";
import "./styles.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: HomePage },
    { path: "/mobile", name: "mobile", component: HomePage, props: { mobileMode: true } },
    { path: "/mobile/rank", name: "mobile-rank", component: RankPage, props: { mobileMode: true } },
    { path: "/chat", name: "chat", component: ChatPage },
    { path: "/agents", name: "agents", component: AgentCenterPage },
    { path: "/feedback", name: "feedback", component: FeedbackPage },
    { path: "/join", name: "join", component: JoinPage },
    { path: "/callback", name: "callback", component: HomePage }
  ]
});

createApp(App).use(router).mount("#app");
