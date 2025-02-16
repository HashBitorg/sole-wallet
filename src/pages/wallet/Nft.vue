<script setup lang="ts">
import { ChevronLeftIcon, GlobeAltIcon } from "@heroicons/vue/outline";
import { DotsHorizontalIcon } from "@heroicons/vue/solid";
import { NFTInfo, SolanaToken } from "@toruslabs/solana-controllers";
import {
  computed,
  defineAsyncComponent,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { VueI18nTranslation } from "vue-i18n";
import { useRouter } from "vue-router";

import FallbackNft from "@/assets/fallback-nft.svg";
import PaperAirplane from "@/assets/paper-airplane.svg";
import BurnNFT from "@/components/burnNFT/BurnNFT.vue";
import {
  NftsPageInteractions,
  trackUserClick,
  TransferPageInteractions,
} from "@/directives/google-analytics";
import ControllerModule, { torus } from "@/modules/controllers";
import { i18n } from "@/plugins/i18nPlugin";
import { STATUS, STATUS_TYPE } from "@/utils/enums";
import { delay, getImgProxyUrl, setFallbackImg } from "@/utils/helpers";
import { NAVIGATION_LIST } from "@/utils/navHelpers";

const router = useRouter();
const t = i18n.global.t as VueI18nTranslation;
const tabs = NAVIGATION_LIST;
const user = computed(() => ControllerModule.userInfo);
const selectedAddress = computed(() => ControllerModule.selectedAddress);
const isOpen = ref(false);
const transferDisabled = ref(false);

const AsyncMessageModal = defineAsyncComponent({
  loader: () =>
    import(
      /* webpackPrefetch: true */ /* webpackChunkName: "MessageModal" */ "@/components/common/MessageModal.vue"
    ),
});

const messageModalState = reactive({
  showMessage: false,
  messageTitle: "",
  messageDescription: "",
  messageStatus: STATUS.INFO as STATUS_TYPE,
});

const showDropDown = ref(false);

const nftMetaData = ref<NFTInfo | undefined>(undefined);
const nfts = computed(() => ControllerModule.nonFungibleTokens);
const mint = ref<string>("");
const burnConfirmed = ref(false);
const edition = ref<string | undefined>("");
const isLoading = ref<boolean>(true);
onMounted(async () => {
  mint.value = router.currentRoute.value.params.mint_address as string;
  const tokenInState = nfts.value.find(
    (nft: SolanaToken) => nft.mintAddress === mint.value,
  );
  if (tokenInState) {
    nftMetaData.value = tokenInState.metaplexData;
  } else {
    // if data is not found in state
    const metaData = await ControllerModule.getNFTmetadata(mint.value);
    nftMetaData.value = metaData;
    edition.value = (metaData?.offChainMetaData as any).edition;
  }
  isLoading.value = false;
});

watch(selectedAddress, (newAddress: string, oldAddress: string) => {
  if (newAddress !== oldAddress) {
    router.push("/wallet/nfts");
  }
});

const goBack = () => {
  router.back();
};

const changeDropdown = () => {
  showDropDown.value = !showDropDown.value;
};

const viewNFT = () => {
  trackUserClick(NftsPageInteractions.SOLSCAN + mint.value);
  window.open(`https://solscan.io/token/${mint.value}`, "_blank");
};

const transferNFT = () => {
  trackUserClick(NftsPageInteractions.SEND + mint.value);
  router.push(`/wallet/transfer?mint=${mint.value}`);
};

const openModal = async () => {
  showDropDown.value = false;
  isOpen.value = true;
  trackUserClick(TransferPageInteractions.INITIATE);
};

const onMessageModalClosed = () => {
  messageModalState.showMessage = false;
  messageModalState.messageDescription = "";
  messageModalState.messageTitle = "";
  messageModalState.messageStatus = STATUS.INFO;
  if (burnConfirmed.value) {
    router.push("/wallet/activity");
  }
};

const closeModal = () => {
  isOpen.value = false;
  trackUserClick(TransferPageInteractions.CANCEL);
};

const showMessageModal = (params: {
  messageTitle: string;
  messageDescription?: string;
  messageStatus: STATUS_TYPE;
}) => {
  const { messageDescription, messageTitle, messageStatus } = params;
  messageModalState.messageDescription = messageDescription || "";
  messageModalState.messageTitle = messageTitle;
  messageModalState.messageStatus = messageStatus;
  messageModalState.showMessage = true;
};
const confirmTransfer = async () => {
  trackUserClick(TransferPageInteractions.CONFIRM);
  // Delay needed for the message modal
  await delay(500);
  try {
    await torus.burnToken(mint.value);
    burnConfirmed.value = true;
    showMessageModal({
      messageTitle: "Your transaction is submitted",
      messageStatus: STATUS.INFO,
    });
  } catch (error) {
    showMessageModal({
      messageTitle: `Burn Failed: ${
        (error as Error)?.message || t("walletSettings.somethingWrong")
      }`,
      messageStatus: STATUS.ERROR,
    });
  }
};
</script>

<template>
  <div class="height-full flex flex-col bg-white dark:bg-app-gray-800">
    <main v-if="nftMetaData" class="flex-1 relative">
      <div
        class="h-[380px] w-full absolute top-0 left-0 flex justify-center items-center overflow-hidden"
      >
        <img
          alt="NFT"
          :src="
            getImgProxyUrl(nftMetaData.offChainMetaData?.image) || FallbackNft
          "
          class="object-cover w-full h-full"
          @error="setFallbackImg($event.target, FallbackNft)"
        />
        <div
          class="h-full w-full bg-gray-800 backdrop-blur-lg bg-opacity-30 absolute top-0 left-0"
        ></div>
      </div>
      <!-- content -->
      <div
        class="px-4 gt-xs:px-12 md:px-12 py-8 lt-md:pb-[56px] relative flex flex-col items-center w-full h-full justify-center md:flex-row md:items-start"
      >
        <div class="flex flex-col relative">
          <div class="flex justify-between px-2 py-4 w-full">
            <div
              class="cursor-pointer flex items-center"
              @click="goBack"
              @keydown="goBack"
            >
              <ChevronLeftIcon class="text-app-text-dark-400 h-4 w-4 mr-2" />
              <span class="text-app-text-dark-400 text-base font-light"
                >Back</span
              >
            </div>
            <DotsHorizontalIcon
              class="h-6 w-6 text-app-text-dark-400 cursor-pointer"
              @click="changeDropdown"
            />
          </div>
          <div
            v-if="showDropDown"
            class="ml-auto w-1/3 absolute right-0 top-5 mt-6"
          >
            <div
              class="rounded-md py-2 flex justify-center items-center bg-white dark:bg-app-gray-800 dark:shadow-none text-app-text-600 dark:text-app-text-dark-white cursor-pointer mb-2"
              @click="openModal"
              @keydown="openModal"
            >
              <span class="text-md">Burn NFT</span>
            </div>
          </div>
          <img
            alt="nft"
            :src="
              getImgProxyUrl(nftMetaData.offChainMetaData?.image) || FallbackNft
            "
            class="h-[480px] w-[480px] object-cover overflow-hidden rounded-lg shadow-lg"
            @error="setFallbackImg($event.target, FallbackNft)"
          />
        </div>
        <div
          class="flex flex-col pt-4 md:pt-14 w-full md:w-[320px] ml-0 md:ml-10 pb-8"
        >
          <div class="w-full flex flex-col">
            <div
              v-if="nftMetaData.offChainMetaData?.collection"
              class="flex items-center"
            >
              <img
                alt="collection"
                :src="
                  getImgProxyUrl(nftMetaData.offChainMetaData?.image) ||
                  FallbackNft
                "
                class="h-5 w-5 object-cover rounded-full overflow-hidden mr-1"
                @error="setFallbackImg($event.target, FallbackNft)"
              />
              <span
                class="text-app-gray-500 md:text-app-text-dark-400 dark:text-app-text-dark-400 text-sm"
                >{{
                  nftMetaData.offChainMetaData?.collection?.name || ""
                }}</span
              >
            </div>
            <h1
              class="text-app-gray-700 md:text-app-text-dark-400 dark:text-app-text-dark-400 text-[26px] font-bold mt-2 truncate"
              :class="
                nftMetaData.offChainMetaData?.collection ? 'md:mt-2' : 'md:mt-6'
              "
            >
              {{ nftMetaData.offChainMetaData?.name || "" }}
            </h1>
            <p
              class="text-app-gray-600 md:text-app-text-dark-400 dark:text-app-text-dark-400 mt-4 text-sm h-20 truncate-multiline"
            >
              {{ nftMetaData.offChainMetaData?.description || "" }}
            </p>
            <div
              class="w-full rounded-full py-2 flex justify-center items-center bg-app-primary-500 md:bg-white dark:bg-white mt-8 cursor-pointer send-nft"
              @click="transferNFT"
              @keydown="transferNFT"
            >
              <img
                alt="paper airplane"
                :src="PaperAirplane"
                class="mr-1 invert md:invert-0 dark:invert-0"
              />
              <span
                class="text-app-text-dark-400 md:text-black dark:text-black text-sm"
                >Send</span
              >
            </div>
            <div
              class="rounded-full py-2 px-3 w-fit flex justify-center items-center bg-app-gray-800 bg-opacity-80 md:bg-opacity-20 md:bg-white dark:bg-white dark:bg-opacity-20 mt-3 cursor-pointer"
              @click="viewNFT"
              @keydown="viewNFT"
            >
              <GlobeAltIcon class="h-3 w-3 text-app-text-dark-400 mr-1" />
              <span class="text-app-text-dark-400 text-xs"
                >View on Solscan</span
              >
            </div>
          </div>
          <div class="w-full flex flex-col mt-7">
            <div v-if="edition" class="flex flex-col space-y-1 mb-4">
              <span class="text-app-gray-500 text-base">Edition</span>
              <span class="text-app-text-dark-400 text-xl">#{{ edition }}</span>
            </div>
            <span
              v-if="(nftMetaData.offChainMetaData?.attributes?.length || 0) > 0"
              class="text-app-gray-500 text-base mb-2"
              >Properties</span
            >
            <div
              v-if="(nftMetaData.offChainMetaData?.attributes?.length || 0) > 0"
              class="grid grid-cols-3 -ml-1"
            >
              <div
                v-for="(value, idx) in nftMetaData.offChainMetaData?.attributes"
                :key="idx"
                class="flex flex-col space-y-1 border-t-2 border-t-[#505154] m-1"
              >
                <span
                  class="text-app-gray-700 dark:text-app-gray-500 text-xs truncate"
                  >{{ value?.trait_type || "" }}</span
                >
                <span
                  class="text-app-gray-500 dark:text-app-text-dark-500 text-xs truncate"
                  >{{ value?.value || "" }}</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
    <main v-else class="flex-1 relative p-8">
      <div
        class="w-full px-4 py-8 bg-app-gray-700 rounded-lg flex flex-col items-center space-y-2"
      >
        <span
          class="text-app-text-dark-500 text-base text-center w-full inline-block"
          >{{ isLoading ? "Loading..." : "Invalid Mint Address" }}</span
        >
        <div
          class="px-4 py-2 bg-app-primary-500 text-app-text-dark-400 rounded-md cursor-pointer"
          @click="goBack"
          @keydown="goBack"
        >
          Back
        </div>
      </div>
    </main>
    <div
      v-if="selectedAddress && user.verifierId"
      class="md:hidden w-full h-14 pb-[10px] flex flex-row align-center justify-around dark:bg-black bg-white border-t border-black fixed bottom-0"
    >
      <router-link
        v-for="(value, key) in tabs"
        :key="key"
        :to="`/wallet/${value.route}`"
        :aria-current="key === 'nfts' ? 'page' : undefined"
        :class="[value.mobHidden ? 'hidden' : 'block']"
      >
        <div
          class="flex flex-col h-full items-center justify-center select-none w-16 py-1"
          :class="[
            key === 'nfts' ? 'active-border border-app-primary-500' : '',
          ]"
        >
          <img
            :src="value.icon"
            alt="link icon"
            class="h-5"
            :class="[
              key === 'nfts'
                ? ControllerModule.isDarkMode
                  ? 'item-white'
                  : 'item-black'
                : 'item-gray opacity-90',
            ]"
          />
          <p
            class="text-xs text-center leading-none mt-1"
            :class="[
              key === 'nfts'
                ? ControllerModule.isDarkMode
                  ? 'item-white'
                  : 'item-black'
                : 'item-gray opacity-90',
            ]"
          >
            {{ t(value.name) || "" }}
          </p>
        </div>
      </router-link>
    </div>
    <template v-if="!isLoading">
      <AsyncMessageModal
        :is-open="messageModalState.showMessage"
        :title="messageModalState.messageTitle"
        :description="messageModalState.messageDescription"
        :status="messageModalState.messageStatus"
        @on-close="onMessageModalClosed"
      />
      <BurnNFT
        :sender-pub-key="ControllerModule.selectedAddress"
        :mint-address="mint"
        :token="nftMetaData"
        :transfer-disabled="transferDisabled"
        :is-open="isOpen"
        @transfer-confirm="confirmTransfer"
        @transfer-reject="closeModal"
        @on-close-modal="closeModal"
      />
    </template>
  </div>
</template>
<style scoped>
.truncate-multiline {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
