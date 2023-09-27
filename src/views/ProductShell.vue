<template>
  <div>
    <EmptyState
      v-if="productError"
      is-error
      class="mt-6"
      :message="productError"
    />
    <template v-else>
      <div class="content">
        <KAlert
          v-if="activeProductVersionDeprecated"
          appearance="warning"
          :alert-message="deprecatedWarning"
          class="deprecated-warning"
        />
        <KSelect
          appearance="select"
          class="version-select-dropdown"
          width="100%"
          data-testid="version-select-dropdown"
          :enable-filtering="false"
          :items="versionSelectItems"
          @change="onChangeVersion"
        >
          <template #empty>
            <div>{{ noResultsMessage }}</div>
          </template>
        </KSelect>
        <!-- pass product to child routes as a prop -->
        <router-view :product="product" />
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import getMessageFromError from '@/helpers/getMessageFromError'
import usePortalApi from '@/hooks/usePortalApi'
import { useI18nStore, useProductStore } from '@/stores'
import type { ProductWithVersions } from '@/stores/product'
import useToaster from '@/composables/useToaster'
import { DocumentContentTypeEnum, ListDocumentsTree } from '@kong/sdk-portal-js'
import { fetchAll } from '@/helpers/fetchAll'
import { Operation } from '@kong-ui-public/spec-renderer'
import { AxiosResponse } from 'axios'
import { sortByDate } from '@/helpers/sortBy'

const emit = defineEmits(['operationSelected'])

defineProps({
  deselectOperation: {
    type: Boolean,
    default: false
  }
})

const versionSelectItems = ref([])

function updateVersionSelectItems () {
  versionSelectItems.value = product.value?.versions
    .slice() // clone before sorting
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((productVersion) => ({
      value: productVersion.id,
      label: `${productVersion.name}${productVersion.deprecated ? helpText.deprecated : ''}`,
      selected: productVersion.id === activeProductVersionId.value
    })) || []
}

function onChangeVersion (event) {
  const version = product.value?.versions.find((productVersion) => productVersion.id === event.value)
  if (!version) {
    return
  }

  productStore.setActiveProductVersionId(version.id)
}



const { notify } = useToaster()
const helpText = useI18nStore().state.helpText
const route = useRoute()
const router = useRouter()
const { portalApiV2 } = usePortalApi()
const productError = ref(null)
const activeProductVersionDeprecated = ref(false)
const deselectOperation = ref<boolean>(false)

const noResultsMessage = helpText.productVersion.unableToRetrieveDoc
const deprecatedWarning = helpText.productVersion.deprecatedWarningProduct

// @ts-ignore
const productStore = useProductStore()
const { product, documentTree, activeDocumentSlug, activeProductVersionId } = storeToRefs(productStore)

const productIdParam = computed(() => route.params.product as string)
const productVersionParam = computed(() => route.params.product_version as string)

function setActiveDocumentSlug () {
  const slugs = route.params.slug

  // The last slug is the active document to be rendered
  const slug = Array.isArray(slugs) ? slugs[slugs.length - 1] : slugs

  if (slug !== activeDocumentSlug.value) {
    productStore.setActiveDocumentSlug(slug)
  }
}

const { productsApi, versionsApi, documentationApi } = portalApiV2.value.service

async function fetchProduct () {
  const id = productIdParam.value

  try {
    const { data: product } = await productsApi.getProduct({ productId: id })

    const productWithVersion: ProductWithVersions = {
      ...product,
      versions: await fetchAll(meta => versionsApi.listProductVersions({ ...meta, productId: id }))
    }

    productStore.setProduct(productWithVersion)
  } catch (err) {
    console.error(err)
    productError.value = getMessageFromError(err)
  }
}

async function fetchDocumentTree () {
  const id = productIdParam.value

  try {
    const requestOptions = {
      productId: id,
      accept: DocumentContentTypeEnum.VndKonnectDocumentTreejson
    }
    // @ts-ignore
    // overriding the axios response because we're specifying what we're accepting above
    const res = await documentationApi.listProductDocuments(requestOptions) as AxiosResponse<ListDocumentsTree, any>

    productStore.setDocumentTree((res.data).data)
  } catch (err) {
    if (err.response.status === 404) {
      productStore.setDocumentTree([])
    } else {
      console.error(err)
      notify({
        appearance: 'danger',
        message: helpText.productVersion.unableToRetrieveDoc
      })
    }
  }
}

function initActiveProductVersionId () {
  if (!product.value) {
    return
  }

  const versions = product.value.versions
    .slice()
    .sort(sortByDate('created_at'))

  if (!versions) {
    return
  }

  const val = productVersionParam.value?.toLowerCase()
  if (val) {
    const newProductVersion = versions.find(
      (productVersion) => productVersion.id === val || productVersion.name?.toLowerCase() === val
    )

    if (newProductVersion) {
      productStore.setActiveProductVersionId(newProductVersion.id)
    }
  }

  if (!activeProductVersionId.value) {
    productStore.setActiveProductVersionId(versions[0]?.id)
  }
}

function routeToDocumentBySlug (slug: string) {
  if (slug) {
    router.replace({
      name: 'api-documentation-page',
      params: {
        product: route.params.product,
        slug: [slug]
      }
    })
  }
}

function onSwitchVersion () {
  if (route.name === 'spec') {
    productStore.setSidebarActiveOperation(null)

    router.push({
      name: 'spec',
      params: {
        product: productIdParam.value,
        product_version: activeProductVersionId.value
      }
    })
  }
}

function onOperationSelectedSidebar (operation: Operation) {
  const routeLocation = {
    name: 'spec',
    params: {
      product: productIdParam.value,
      product_version: activeProductVersionId.value
    }
  }

  if (route.name !== 'spec') {
    router.push(routeLocation).then(() => productStore.setSidebarActiveOperation(operation))
  } else {
    router.replace(routeLocation).then(() => productStore.setSidebarActiveOperation(operation))
  }
}

onMounted(async () => {
  setActiveDocumentSlug()
  await fetchProduct()
  await fetchDocumentTree()
  initActiveProductVersionId()
  updateVersionSelectItems()
})

watch(() => productVersionParam.value, () => {
  if (productVersionParam.value && (productVersionParam.value !== activeProductVersionId.value)) {
    productStore.setActiveProductVersionId(productVersionParam.value)
  }

  initActiveProductVersionId()
})

// This ensures deselection of operations in the sidebar when the user navigates away from the spec page
watch(() => route.name, () => {
  deselectOperation.value = route.name !== 'spec'
})

watch([
  () => product.value,
  () => activeProductVersionId.value
], () => {
  updateVersionSelectItems()
})

watch(() => activeProductVersionId.value, (newVal, oldVal) => {
  if (oldVal && (newVal !== oldVal)) {
    onSwitchVersion()
  }

  if (!product.value?.version_count) {
    return
  }

  const newProductVersion = product.value.versions.filter((version) => version.id === activeProductVersionId.value)[0]

  activeProductVersionDeprecated.value = newProductVersion?.deprecated
})

watch(() => productIdParam.value, () => {
  if (productIdParam.value !== product.value?.id) {
    productStore.setProduct(null)
  }
})

watchEffect(() => {
  setActiveDocumentSlug()

  if (documentTree.value && !activeDocumentSlug.value && route.path.includes('/docs/')) {
    const firstDocumentSlug = documentTree.value[0]?.slug

    routeToDocumentBySlug(firstDocumentSlug)
  }
})
</script>
