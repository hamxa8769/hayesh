import { GigCard } from "@/components/cards/GigCard"
import { TeacherCard } from "@/components/cards/TeacherCard"
import { AIServiceCard } from "./AIServiceCard"
import type { ExploreItem } from "./explore-data"

/** Renders the right shared card for an explore item. */
export function ItemCard({ item }: { item: ExploreItem }) {
  switch (item.kind) {
    case "teacher":
      return (
        <TeacherCard
          id={item.id}
          displayName={item.title}
          photoUrl={item.photoUrl}
          tagline={item.blurb || null}
          subjects={item.subjects}
          rating={item.rating}
          totalReviews={item.totalReviews}
          totalStudents={item.totalStudents}
          lowestPrice={item.price}
          translationEnabled={item.translationEnabled}
          lessonTypes={item.lessonTypes}
          experienceYears={item.experienceYears}
          featured={item.featured}
        />
      )
    case "gig":
      return (
        <GigCard
          id={item.id}
          title={item.title}
          category={item.category}
          coverUrl={item.coverUrl}
          seller={{ display_name: item.sellerName, avatar_url: item.sellerAvatar, level: item.sellerLevel }}
          rating={item.rating}
          count={item.orders}
          startingPrice={item.price}
          deliveryDays={item.deliveryDays}
          reviewCount={item.reviewCount}
          packageCount={item.packageCount}
          featured={item.featured}
        />
      )
    case "ai":
      return (
        <AIServiceCard
          id={item.id}
          title={item.title}
          description={item.blurb || null}
          thumbnailUrl={item.thumbnailUrl}
          rating={item.rating}
          orders={item.orders}
          price={item.price}
          deliveryHrs={item.deliveryHrs}
        />
      )
  }
}
